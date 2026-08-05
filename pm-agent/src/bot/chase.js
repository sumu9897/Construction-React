/**
 * The daily chase loop.
 *
 * One question at a time, in priority order, phrased as a conversation rather
 * than a form. Every answer is written to the Ledger and committed immediately,
 * so the record exists even if the session is abandoned halfway through.
 *
 * The loop is deliberately short. Six good questions get answered every morning;
 * a forty-question interrogation gets ignored by the second week, and a chase
 * loop that gets ignored takes the whole system down with it.
 */

import path from 'node:path';
import { projectPaths } from '../ledger/paths.js';
import { readYaml, writeYaml, appendMarkdown, writeJson, readJson, exists } from '../ledger/store.js';
import { commitLedger } from '../ledger/git.js';
import { loadLatestProgramme } from '../programme/ingest.js';
import { computeExceptions } from '../analysis/exceptions.js';
import { parseReply } from './parseReply.js';
import { writeP6Update } from '../export/p6update.js';
import { today, formatHuman, addDays } from '../util/dates.js';

/**
 * Who is answering. Defaults to the terminal, so the CLI keeps working unchanged.
 *
 * This matters more than it looks: a diary entry that says "reported by the site
 * engineer on 5 August" is materially stronger evidence than one that says
 * "telegram-chase", and by the time you need it you cannot reconstruct it.
 */
export const TERMINAL_AUTHOR = { id: 'terminal', name: 'terminal' };

const authorId = (author) => String(author?.id ?? TERMINAL_AUTHOR.id);

/**
 * One session per person, not per project.
 *
 * Two people running /chase on the same project at the same time would otherwise
 * overwrite each other's answers - and would do it silently, which is worse.
 */
const sessionFile = (projectCode, author) =>
  path.join(projectPaths(projectCode).root, `.chase-session-${authorId(author)}.json`);

/**
 * Sessions are persisted so a bot restart mid-conversation does not lose the
 * answers already given. The file is transient state, not part of the record -
 * it is gitignored.
 */
async function saveSession(session) {
  await writeJson(sessionFile(session.project, session.author), session);
}

async function loadSession(projectCode, author = TERMINAL_AUTHOR) {
  const file = sessionFile(projectCode, author);
  if (!(await exists(file))) return null;
  return readJson(file);
}

async function clearSession(projectCode, author = TERMINAL_AUTHOR) {
  const file = sessionFile(projectCode, author);
  if (await exists(file)) await writeJson(file, { cleared: true, at: new Date().toISOString() });
}

export async function startChase(
  projectCode,
  { asOf = today(), limit, author = TERMINAL_AUTHOR } = {},
) {
  const paths = projectPaths(projectCode);
  const config = (await readYaml(paths.config)) ?? {};
  const latest = await loadLatestProgramme(projectCode);

  if (!latest) {
    return {
      status: 'no-programme',
      message:
        `No parsed programme for *${projectCode}* yet.\n\n` +
        `Export from P6 (.xer) or MS Project (Save As → XML) and run \`pm ingest ${projectCode} <file>\`.`,
    };
  }

  const progress = (await readYaml(paths.progress)) ?? { activities: {} };
  const exceptions = computeExceptions(latest.programme, {
    asOf,
    config: config.chase ?? {},
    progress,
    limit,
  });

  if (exceptions.questions.length === 0) {
    return {
      status: 'clear',
      exceptions,
      message:
        `*${projectCode}* — nothing to chase as of ${formatHuman(asOf)}.\n\n` +
        `${exceptions.total} exceptions found, ${exceptions.suppressed} already answered today.`,
    };
  }

  const session = {
    project: projectCode,
    author,
    asOf,
    startedAt: new Date().toISOString(),
    dataDate: exceptions.dataDate,
    programmeAgeDays: exceptions.programmeAgeDays,
    index: 0,
    queue: exceptions.questions,
    answers: [],
    pendingFollowUp: null,
  };

  await saveSession(session);

  return {
    status: 'started',
    session,
    exceptions,
    message: buildOpening(projectCode, exceptions),
    question: session.queue[0].question,
  };
}

function buildOpening(projectCode, exceptions) {
  const lines = [`*${projectCode}* — daily update, ${formatHuman(exceptions.asOf)}`];

  if (exceptions.programmeAgeDays !== null && exceptions.programmeAgeDays > 7) {
    lines.push('');
    lines.push(
      `⚠️ Programme data date is ${exceptions.programmeAgeDays} days old (${exceptions.dataDate}). These questions are being asked against stale logic — worth re-exporting from P6.`,
    );
  }

  lines.push('');
  lines.push(
    `${exceptions.total} activities need attention. Asking about the top ${exceptions.questions.length}${exceptions.remaining ? `, ${exceptions.remaining} held back` : ''}.`,
  );
  lines.push('');
  lines.push('_Answer however you like — "started tuesday, 30%, waiting on blocks" is fine. `skip` to move on, `stop` to end._');

  return lines.join('\n');
}

/**
 * Apply one reply and advance. Returns the next prompt, or the closing summary.
 */
export async function answerChase(projectCode, text, { author = TERMINAL_AUTHOR } = {}) {
  const session = await loadSession(projectCode, author);
  if (!session || session.cleared || session.index >= session.queue.length) {
    return { status: 'no-session', message: 'No chase in progress. Send `/chase` to start one.' };
  }

  const command = text.trim().toLowerCase();

  if (command === 'stop' || command === 'cancel') {
    const summary = await finishChase(projectCode, session, { aborted: true });
    return { status: 'stopped', ...summary };
  }

  const current = session.queue[session.index];

  if (command === 'skip') {
    session.index += 1;
    session.pendingFollowUp = null;
    await saveSession(session);
    return nextPrompt(session, `Skipped ${current.code}.`);
  }

  // A follow-up is outstanding - attach the reply to the answer already given
  // rather than treating it as a fresh answer.
  if (session.pendingFollowUp) {
    const answer = session.answers.at(-1);
    if (session.pendingFollowUp === 'delay-responsibility' && answer?.delay) {
      answer.delay.responsibility = classifyResponsibility(text);
      answer.delay.clarification = text;
    } else if (session.pendingFollowUp === 'start-date' && answer) {
      const reparsed = parseReply(text, { asOf: session.asOf, exception: current });
      answer.actualStart = reparsed.actualStart ?? answer.actualStart;
      answer.percentComplete = reparsed.percentComplete ?? answer.percentComplete;
    }
    session.pendingFollowUp = null;
    session.index += 1;
    await saveSession(session);
    return nextPrompt(session, 'Logged.');
  }

  const parsed = parseReply(text, { asOf: session.asOf, exception: current });

  const answer = {
    activityId: current.activityId,
    code: current.code,
    name: current.name,
    kind: current.kind,
    totalFloatDays: current.totalFloatDays,
    askedAt: new Date().toISOString(),
    reply: text,
    status: parsed.status,
    percentComplete: parsed.percentComplete,
    actualStart: parsed.actualStart,
    actualFinish: parsed.actualFinish,
    forecastFinish: parsed.forecastFinish,
    remainingDays: parsed.remainingDays,
    delay: parsed.delay,
    confidence: parsed.confidence,
    ambiguous: parsed.ambiguous,
  };

  session.answers.push(answer);

  // A delay event is the single most valuable thing said on a site call, and
  // the responsibility split decides entitlement. Always ask - never infer.
  if (parsed.delay && parsed.delay.responsibility === null) {
    session.pendingFollowUp = 'delay-responsibility';
    await saveSession(session);
    return {
      status: 'follow-up',
      message:
        `Logged as a delay event against ${current.code}.\n\n` +
        `Was that *client/consultant-caused*, *our own/supplier*, or *neutral* (weather etc.)? ` +
        `It decides whether this supports a claim later, so I will not guess.`,
      buttons: RESPONSIBILITY_BUTTONS,
    };
  }

  if (parsed.status === 'in-progress' && !parsed.actualStart) {
    session.pendingFollowUp = 'start-date';
    await saveSession(session);
    return {
      status: 'follow-up',
      message: `Noted ${current.code} is running. What date did it actually start?`,
    };
  }

  session.index += 1;
  await saveSession(session);
  return nextPrompt(session, 'Logged.');
}

/**
 * The fixed choices for "whose delay is it", phrased for buttons. `send` is
 * what the button feeds back through the ordinary message path, chosen so
 * classifyResponsibility reads it the same as a typed answer. A tap is still a
 * human answering - the rule against inferring entitlement is untouched.
 */
export const RESPONSIBILITY_BUTTONS = [
  [
    { label: 'Client / consultant', send: 'consultant' },
    { label: 'Our side / supplier', send: 'supplier' },
  ],
  [{ label: 'Neutral — weather etc.', send: 'neutral' }],
];

export function classifyResponsibility(text) {
  const lower = text.toLowerCase();
  if (/client|employer|consultant|engineer|architect|consultant|design/.test(lower)) return 'employer';
  if (/us|our|we|supplier|subcontractor|sub|own|internal|contractor/.test(lower)) return 'contractor';
  if (/weather|rain|neutral|force majeure|storm/.test(lower)) return 'neutral';
  return 'unclassified';
}

function nextPrompt(session, acknowledgement) {
  if (session.index >= session.queue.length) {
    return { status: 'ready-to-close', message: acknowledgement, done: true };
  }
  const next = session.queue[session.index];
  return {
    status: 'asking',
    message: `${acknowledgement}\n\n*${session.index + 1}/${session.queue.length}* — ${next.question}`,
    question: next.question,
  };
}

/**
 * Write the session to the Ledger: progress, diary, delay events, and the
 * P6-importable update. Commits once, atomically, with a message that names the
 * date so `git log` reads as a chronology.
 */
export async function finishChase(
  projectCode,
  sessionArg,
  { aborted = false, author = TERMINAL_AUTHOR } = {},
) {
  const session = sessionArg ?? (await loadSession(projectCode, author));
  const who = session?.author ?? author;

  // A cleared session has no answers array - finishing twice (or finishing
  // a session that never started) reports nothing rather than throwing.
  if (!session || session.cleared || !session.answers?.length) {
    await clearSession(projectCode, who);
    return { message: 'Nothing recorded.', written: [] };
  }

  const paths = projectPaths(projectCode);
  const written = [];

  // 1. progress.yaml - current state, keyed by activity code.
  const progress = (await readYaml(paths.progress)) ?? { project: projectCode, activities: {} };
  progress.activities ??= {};
  progress.updatedAt = new Date().toISOString();

  for (const answer of session.answers) {
    const key = answer.code ?? answer.activityId;
    const previous = progress.activities[key] ?? {};
    progress.activities[key] = {
      ...previous,
      name: answer.name,
      status: answer.status ?? previous.status ?? null,
      percentComplete: answer.percentComplete ?? previous.percentComplete ?? null,
      actualStart: answer.actualStart ?? previous.actualStart ?? null,
      actualFinish: answer.actualFinish ?? previous.actualFinish ?? null,
      forecastFinish: answer.forecastFinish ?? previous.forecastFinish ?? null,
      remainingDays: answer.remainingDays ?? previous.remainingDays ?? null,
      updatedAt: answer.askedAt,
      source: 'telegram-chase',
      reportedBy: who.name ?? null,
      reportedById: who.id ?? null,
      reply: answer.reply,
    };
  }

  await writeYaml(paths.progress, progress);
  written.push(paths.progress);

  // 2. Delay events - the raw material of every EOT claim.
  const config = (await readYaml(paths.config)) ?? {};
  const noticeDays = config.contract?.delayNoticeDays ?? null;

  const delays = session.answers.filter((a) => a.delay);
  const noticeDeadlines = [];

  if (delays.length > 0) {
    const events = (await readYaml(paths.events)) ?? { nextRef: 1, entries: [] };
    events.entries ??= [];
    events.nextRef ??= 1;

    for (const answer of delays) {
      // Entitlement is a contractual judgement, not a keyword match, so
      // responsibility stays as answered. But the notice clock starts from
      // awareness regardless of who is at fault, and it is the clock - not the
      // merits - that most claims are actually lost on. Compute it whenever the
      // event could conceivably support one.
      const responsibility = answer.delay.responsibility ?? 'unclassified';
      const maySupportClaim = responsibility !== 'contractor';
      const deadline = noticeDays && maySupportClaim ? addDays(session.asOf, noticeDays) : null;

      if (deadline) {
        noticeDeadlines.push({ ref: `EV-${String(events.nextRef).padStart(3, '0')}`, deadline, activity: answer.code });
      }

      events.entries.push({
        ref: `EV-${String(events.nextRef).padStart(3, '0')}`,
        date: session.asOf,
        activity: answer.code,
        activityName: answer.name,
        description: answer.delay.description,
        responsibility,
        responsibilityHint: answer.delay.responsibilityHint ?? null,
        clarification: answer.delay.clarification ?? null,
        floatAtTimeDays: answer.totalFloatDays,
        noticeIssued: false,
        noticeDeadline: deadline,
        noticeBasis: deadline
          ? `${noticeDays} days from awareness (${session.asOf}) per project.yaml contract.delayNoticeDays`
          : noticeDays
            ? 'Own/supplier cause as answered - no notice computed'
            : 'contract.delayNoticeDays not set in project.yaml',
        // Who said it, not just how it arrived. By the time this matters in a
        // claim you cannot reconstruct it.
        recordedBy: who.name ?? 'telegram-chase',
        recordedById: who.id ?? null,
        recordedVia: 'telegram-chase',
        recordedAt: answer.askedAt,
      });
      events.nextRef += 1;
    }

    await writeYaml(paths.events, events);
    written.push(paths.events);
  }

  // 3. Site diary - prose, because this is what gets quoted in a claim.
  const diaryBlock = buildDiaryEntry(session, aborted);
  await appendMarkdown(paths.diary, diaryBlock);
  written.push(paths.diary);

  // 4. P6-importable update, for the answers that carry schedule data.
  const updatable = session.answers.filter(
    (a) => a.actualStart || a.actualFinish || a.percentComplete !== null || a.remainingDays !== null,
  );
  const p6 = await writeP6Update(projectCode, updatable, { asOf: session.asOf });
  if (p6) written.push(p6.file);

  const sha = await commitLedger(
    written,
    `ledger(${projectCode}): site update ${session.asOf} by ${who.name ?? 'terminal'} — ${session.answers.length} activities${delays.length ? `, ${delays.length} delay event(s)` : ''}`,
  );

  await clearSession(projectCode, who);

  return {
    written,
    p6,
    sha,
    delays: delays.length,
    noticeDeadlines,
    answered: session.answers.length,
    message: buildClosing(session, { p6, sha, delays: delays.length, noticeDeadlines, aborted }),
  };
}

function buildDiaryEntry(session, aborted) {
  const lines = [`## ${session.asOf}`, ''];
  lines.push(
    `Site update reported by ${session.author?.name ?? 'unknown'}` +
      `${session.author?.id === TERMINAL_AUTHOR.id ? ' at the terminal' : ' via Telegram'}` +
      `${aborted ? ' (session ended early)' : ''}. Programme data date ${session.dataDate ?? 'unknown'}.`,
  );
  lines.push('');

  for (const answer of session.answers) {
    const bits = [];
    if (answer.status) bits.push(answer.status);
    if (answer.percentComplete !== null) bits.push(`${answer.percentComplete}%`);
    if (answer.actualStart) bits.push(`started ${answer.actualStart}`);
    if (answer.actualFinish) bits.push(`finished ${answer.actualFinish}`);
    if (answer.forecastFinish) bits.push(`forecast finish ${answer.forecastFinish}`);

    lines.push(`- **${answer.code} ${answer.name ?? ''}** — ${bits.join(', ') || 'no change reported'}`);
    lines.push(`  > "${answer.reply}"`);

    if (answer.delay) {
      lines.push(
        `  - Delay event recorded. Responsibility: ${answer.delay.responsibility ?? 'unclassified'}.`,
      );
    }
    if (answer.ambiguous?.length) {
      lines.push(`  - Not captured: ${answer.ambiguous.join('; ')}.`);
    }
  }

  return lines.join('\n');
}

function buildClosing(session, { p6, sha, delays, noticeDeadlines = [], aborted }) {
  const lines = [];
  lines.push(
    `${aborted ? 'Session ended.' : 'Done.'} Recorded *${session.answers.length}* activities to the ledger.`,
  );

  if (delays > 0) {
    lines.push('');
    lines.push(`⚠️ *${delays} delay event${delays === 1 ? '' : 's'} logged.*`);
  }

  if (noticeDeadlines.length > 0) {
    lines.push('');
    // The single most valuable line the agent ever sends. Entitlement is lost
    // on missed notice periods far more often than on weak merits.
    for (const notice of noticeDeadlines) {
      lines.push(
        `📄 *${notice.ref}* (${notice.activity}) — notice due by *${formatHuman(notice.deadline)}*.`,
      );
    }
    lines.push('');
    lines.push('_Check the clause reference before issuing. I draft; you send._');
  } else if (delays > 0) {
    lines.push('_No notice deadline computed — set `contract.delayNoticeDays` in project.yaml._');
  }

  if (p6) {
    lines.push('');
    lines.push(
      `P6 update ready: \`${path.basename(p6.file)}\` (${p6.rowCount} ${p6.rowCount === 1 ? 'row' : 'rows'}).`,
    );
    lines.push('_Import via P6 Excel import and review before saving. I do not touch the XER._');
  }

  if (sha) {
    lines.push('');
    lines.push(`Committed \`${sha.slice(0, 8)}\`.`);
  }

  return lines.join('\n');
}

export { loadSession, clearSession };
