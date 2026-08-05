/**
 * The Telegram PM agent process.
 *
 * Runs continuously on the Mac mini under launchd. Three modes:
 *   push    - cron fires `pm chase --send` and it starts the conversation
 *   pull    - you ask it something and it answers from the Ledger
 *   capture - you send a voice note or photo and it files the content
 */

import path from 'node:path';
import { Telegram, chunk, keyboard } from './telegram.js';
import {
  startChase,
  answerChase,
  finishChase,
  loadSession,
  classifyResponsibility,
  RESPONSIBILITY_BUTTONS,
} from './chase.js';
import { askLedger } from './ask.js';
import { captureEntry, amendEntry, CAPTURE_KINDS } from './capture.js';
import { ingestVoiceNote } from './diary.js';
import { entriesOf } from '../ledger/registers.js';
import { openItems, writeChaseDraft } from '../correspondence/chase-draft.js';
import { fileDocument } from '../documents/intake.js';
import { loadBrand } from '../report/html/brand.js';
import { projectPaths, ledgerRoot } from '../ledger/paths.js';
import { readYaml, writeYaml, listFiles, exists, ensureDir } from '../ledger/store.js';
import { loadLatestProgramme, loadLastTwoProgrammes } from '../programme/ingest.js';
import { diffProgrammes } from '../analysis/diff.js';
import { checkProgrammeHealth } from '../analysis/health.js';
import { computeExceptions } from '../analysis/exceptions.js';
import { contractPosition, formatContract, formatMoney } from '../analysis/contract.js';
import { renderDiff, renderHealth, renderExceptions } from '../report/render.js';
import { generateWeeklyReport, summarisePdfError } from '../report/generate.js';
import { runAlerts, formatAlertBatch, formatOpenAlerts } from '../alerts/index.js';
import { commitLedger } from '../ledger/git.js';
import { writeFile, readFile } from 'node:fs/promises';
import { today, formatHuman, addDays } from '../util/dates.js';

const STATE_FILE = () => path.join(ledgerRoot(), '.agent-state.yaml');

async function readState() {
  return (await readYaml(STATE_FILE())) ?? { activeProject: null, chats: {} };
}

async function writeState(state) {
  await ensureDir(ledgerRoot());
  await writeYaml(STATE_FILE(), state, { header: 'Telegram agent runtime state' });
}

async function listProjects() {
  const root = ledgerRoot();
  if (!(await exists(root))) return [];
  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(root, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort();
}

/**
 * Only respond to chats you have explicitly allowed. A PM bot holds contract sums,
 * rates and claims strategy; an open bot is a disclosure incident.
 *
 * In a one-to-one chat the chat id and the sender id are the same, so either will
 * do. They diverge in a group, where the chat id identifies the group - so accept
 * both, and let the allowlist hold whichever you added.
 */
function isAuthorised(chatId, fromId) {
  const allowed = (process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.length === 0) return false;
  return allowed.includes(String(chatId)) || (fromId && allowed.includes(String(fromId)));
}

/**
 * Who sent this.
 *
 * Attribution is not bookkeeping - a diary entry that names the person who reported
 * it is materially stronger evidence than one that says "telegram", and it cannot be
 * reconstructed later.
 */
function authorOf(message) {
  const from = message.from ?? {};
  const name =
    [from.first_name, from.last_name].filter(Boolean).join(' ') ||
    from.username ||
    `telegram:${from.id}`;
  return { id: from.id ?? message.chat.id, name, username: from.username ?? null };
}

/**
 * The command list Telegram shows in its own Menu button.
 *
 * Registered with setMyCommands at startup, so the blue Menu beside the message
 * box lists every action with a description - no memorising, and no typing on a
 * phone at a site gate. Telegram caps descriptions at 256 characters and the
 * command itself at 32, lowercase.
 */
export const COMMAND_MENU = [
  { command: 'today', description: 'Where the project stands and what needs you' },
  { command: 'update', description: 'The site update — I ask, you answer' },
  { command: 'log', description: 'Record anything — /log order tiles owner Jihad due 1 aug' },
  { command: 'contract', description: 'The contract I am working to, and where you are exposed' },
  { command: 'report', description: "This week's client report" },
  { command: 'ask', description: 'Ask anything about the project record' },
  { command: 'help', description: 'Everything else I can do' },
];

/**
 * The button panel. Rows are the shape of a working day: look at it, act on it,
 * record something, ask something.
 */
const MENU_ROWS = [
  [
    { label: '📋 Today', send: '/today' },
    { label: '🎙 Site update', send: '/update' },
  ],
  [
    { label: '📝 Record something', send: '/log' },
    { label: '📜 Contract', send: '/contract' },
  ],
  [
    { label: '📄 Weekly report', send: '/report' },
    { label: '📮 Open items', send: '/open' },
  ],
  [
    { label: '⋯ More', send: '/more' },
  ],
];

/** The commands that are not on the menu but still work. */
const MORE_ROWS = [
  [
    { label: '📈 Programme change', send: '/diff' },
    { label: '🩺 Programme health', send: '/health' },
  ],
  [
    { label: '🔭 Look-ahead', send: '/lookahead' },
    { label: '🔔 All alerts', send: '/alerts' },
  ],
  [
    { label: '📖 Project brief', send: '/brief' },
    { label: '🗂 Switch project', send: '/projects' },
  ],
];

/**
 * The parties that own things on a construction project, and the deadlines
 * anyone actually sets. Offered as taps because the alternative is remembering
 * a syntax on a phone, in the dark, at the end of a site day.
 *
 * Suggestions only - every one of them is a value the author chose. Nothing here
 * fills a field in on its own.
 */
const OWNER_CHOICES = ['Client', 'Consultant', 'PMCC', 'Subcontractor'];
const DUE_CHOICES = [
  { label: 'Today', value: 'today' },
  { label: 'Friday', value: 'friday' },
  { label: 'Next week', value: 'next week' },
  { label: 'End of month', value: 'end of month' },
];

/**
 * The classification offered after `/log`. Derived from CAPTURE_KINDS so a new
 * register cannot be added without becoming reachable from the phone.
 */
export const CAPTURE_BUTTONS = [
  Object.entries(CAPTURE_KINDS).map(([kind, spec]) => ({
    label: `${spec.icon ?? '•'} ${spec.buttonLabel ?? spec.label}`,
    send: `/logas ${kind}`,
  })),
];

/** Button rows for whatever a just-logged entry is still missing. */
function fillRows(ref, missing = []) {
  const rows = [];
  if (missing.includes('owner')) {
    rows.push(OWNER_CHOICES.map((who) => ({ label: `👤 ${who}`, send: `/set ${ref} owner ${who}` })));
  }
  if (missing.includes('due')) {
    rows.push(DUE_CHOICES.map((d) => ({ label: `📅 ${d.label}`, send: `/set ${ref} due ${d.value}` })));
  }
  return rows;
}

const HELP = `*Construction PM agent*

Six things, and you only need the first three.

\`/today\` — where the project stands, what the contract has running
against you, and what is waiting on someone else
\`/update\` — the site update: I ask, you answer
\`/log <anything>\` — record it, I ask what kind it is
\`/contract\` — the terms I am working to, and where you are exposed
\`/report\` — this week's client report
\`/ask <question>\` — or just start a message with ?

Send a photo or a document and I file it as evidence.

_Also available:_ \`/open\` \`/alerts\` \`/diff\` \`/health\` \`/lookahead\`
\`/nudge REF\` \`/set REF field value\` \`/brief\` \`/projects\`
Tap *⋯ More* on \`/menu\` for those as buttons.`;

async function resolveProject(state, chatId) {
  const perChat = state.chats?.[chatId]?.activeProject;
  if (perChat) return perChat;
  if (state.activeProject) return state.activeProject;
  const projects = await listProjects();
  return projects[0] ?? null;
}

async function handleCommand(tg, chatId, text, state, author) {
  const [rawCommand, ...args] = text.trim().split(/\s+/);
  const command = rawCommand.toLowerCase().replace(/@.*$/, '');
  const project = await resolveProject(state, chatId);

  switch (command) {
    case '/start':
    case '/help':
      await tg.send(chatId, HELP, keyboard(MENU_ROWS));
      return true;

    case '/menu':
      await tg.send(
        chatId,
        project ? `*${project}* — what would you like?` : 'What would you like?',
        keyboard(MENU_ROWS),
      );
      return true;

    case '/more':
      await tg.send(chatId, 'Everything else:', keyboard(MORE_ROWS));
      return true;

    /**
     * The brief is the contract context every skill reads before it writes a word.
     * Being able to see it from the phone is what stops it silently going stale.
     */
    case '/brief': {
      if (!project) return true;
      const paths = projectPaths(project);
      const brief = (await exists(paths.projectBrief)) ? await readFile(paths.projectBrief, 'utf8') : null;

      if (!brief) {
        await tg.send(
          chatId,
          `*${project}* has no brief yet.\n\n` +
            'The brief is `CLAUDE.md` in the project folder — parties, contract form, ' +
            'sums, notice periods. Everything I write cites it, so a chase letter ' +
            'without one cannot quote a clause.\n\n' +
            'Edit it on the laptop, or send me the contract as a document and I will file it.',
        );
        return true;
      }

      for (const part of chunk(brief)) await tg.send(chatId, part);
      await tg.send(chatId, '_Edit this in `CLAUDE.md` in the project folder._');
      return true;
    }

    /**
     * One way in for anything worth recording.
     *
     * The three registers still have their own commands, but nobody standing on
     * a site remembers which of them a thought belongs in. So take the words
     * first and ask the one question that decides where they land.
     */
    case '/log': {
      if (!project) return true;
      const body = args.join(' ').trim();

      if (!body) {
        await tg.send(
          chatId,
          '*Record something*\n\nWrite it the way you would say it:\n' +
            '`/log order the ridge tiles owner Jihad due 1 aug`\n\n' +
            'I read the owner and the date out of the sentence, then ask what kind of thing it is.',
        );
        return true;
      }

      // Held rather than filed: the register is not known yet, and writing to the
      // wrong one then moving it would leave two entries in the git history.
      state.chats ??= {};
      state.chats[chatId] ??= {};
      state.chats[chatId].pendingCapture = body;
      await writeState(state);

      await tg.send(
        chatId,
        `*${body}*\n\nWhat is this?`,
        keyboard(CAPTURE_BUTTONS),
      );
      return true;
    }

    case '/logas': {
      if (!project) return true;
      const kind = (args[0] ?? '').toLowerCase();
      const held = state.chats?.[chatId]?.pendingCapture;

      if (!CAPTURE_KINDS[kind] || !held) {
        await tg.send(chatId, 'Nothing waiting to be filed. Start with `/log <what happened>`.');
        return true;
      }

      delete state.chats[chatId].pendingCapture;
      await writeState(state);

      return handleCommand(tg, chatId, `/${kind} ${held}`, state, author);
    }

    case '/risk':
    case '/decision':
    case '/action': {
      if (!project) return true;
      const kind = command.slice(1);
      const spec = CAPTURE_KINDS[kind];
      const body = args.join(' ').trim();

      if (!body) {
        await tg.send(
          chatId,
          `*Log a ${kind}*\n\nSend it as one line:\n\`${spec.example}\`\n\n` +
            'Only the first part is required — everything after a `|` is optional, ' +
            'and I record what is missing rather than guessing it.',
        );
        return true;
      }

      const result = await captureEntry(project, kind, body, { author });
      if (!result) {
        await tg.send(chatId, `I need something to record. \`${spec.example}\``);
        return true;
      }

      const lines = [`${result.label} \`${result.ref}\` logged.`, '', `*${result.entry.subject}*`];
      if (result.entry.owner) lines.push(`Owner: ${result.entry.owner}`);
      if (result.entry.dueDate) lines.push(`Due: ${formatHuman(result.entry.dueDate)}`);
      if (result.entry.impact) lines.push(`Impact: ${result.entry.impact}`);
      if (result.entry.mitigation) lines.push(`Mitigation: ${result.entry.mitigation}`);

      if (result.dueUnreadable) {
        lines.push('', `_I could not read "${result.dueUnreadable}" as a date, so no deadline is set._`);
      }
      if (result.unparsed.length > 0) {
        lines.push('', `_Kept as written but not understood as a field: ${result.unparsed.join('; ')}_`);
      }

      // Named, never filled in - but asked for, because a missing owner is a
      // missing chase and one tap is cheaper than remembering the syntax.
      if (result.missing.length > 0) {
        lines.push('', `_No ${result.missing.join(' or ')} recorded._`);
      }

      await tg.send(chatId, lines.join('\n'), keyboard(fillRows(result.ref, result.missing)));
      return true;
    }

    /**
     * Fill in a field on something already logged - what the follow-up buttons
     * send, and how you fix a typo from the phone.
     */
    case '/set': {
      if (!project) return true;
      const [ref, field, ...rest] = args;
      const value = rest.join(' ').trim();

      if (!ref || !field || !value) {
        await tg.send(chatId, 'Use `/set ACT-003 owner Jihad` or `/set ACT-003 due friday`.');
        return true;
      }

      const result = await amendEntry(project, ref, field, value, { author });
      if (!result) {
        await tg.send(chatId, `I do not have \`${ref}\`, or \`${field}\` is not a field I set.`);
        return true;
      }
      if (result.unreadable) {
        await tg.send(chatId, `I could not read "${result.unreadable}" as a date. Try \`1 aug\`, \`friday\` or \`2026-08-01\`.`);
        return true;
      }

      const shown = result.field === 'due' ? formatHuman(result.value) : result.value;
      const stillMissing = ['owner', 'due'].filter(
        (f) => (f === 'due' ? !result.entry.dueDate : !result.entry[f]),
      );

      await tg.send(
        chatId,
        `\`${result.ref}\` — ${result.field} set to *${shown}*.`,
        keyboard(fillRows(result.ref, stillMissing)),
      );
      return true;
    }

    case '/projects': {
      const projects = await listProjects();
      // One button per project; a tap is exactly `/project CODE`.
      await tg.send(
        chatId,
        projects.length
          ? `Projects:\n${projects.map((p) => `- \`${p}\`${p === project ? '  ← active' : ''}`).join('\n')}\n\n_Tap to switch:_`
          : `No projects yet. Run \`pm init <CODE>\` on the Mac mini.`,
        projects.length
          ? keyboard(projects.map((p) => [{ label: p === project ? `${p} ←` : p, send: `/project ${p}` }]))
          : {},
      );
      return true;
    }

    case '/project': {
      const code = args[0];
      const projects = await listProjects();
      if (!code || !projects.includes(code)) {
        await tg.send(chatId, `Unknown project. Available: ${projects.join(', ') || 'none'}`);
        return true;
      }
      state.chats ??= {};
      state.chats[chatId] = { ...(state.chats[chatId] ?? {}), activeProject: code };
      await writeState(state);
      await tg.send(chatId, `Active project is now *${code}*.`);
      return true;
    }

    // "Update" is what this is called on site. /chase is kept because it is what
    // the cron job and the CLI have always sent.
    case '/update':
    case '/chase': {
      if (!project) {
        await tg.send(chatId, 'No project set. `/projects` to see what is available.');
        return true;
      }
      const result = await startChase(project, { author });
      await tg.send(chatId, result.message);
      if (result.question) {
        await tg.send(chatId, `*1/${result.session.queue.length}* — ${result.question}`);
      }
      return true;
    }

    /**
     * The one screen.
     *
     * Where the project stands, what the contract has running against you, and
     * what is waiting on someone else - in that order, because that is the order
     * it matters in. This exists so that the answer to "what do I open in the
     * morning" is a single command rather than four.
     */
    case '/today': {
      if (!project) return true;

      const latest = await loadLatestProgramme(project);
      const paths = projectPaths(project);
      const config = (await readYaml(paths.config)) ?? {};
      const lines = [`*${project}* — ${formatHuman(today())}`, ''];

      if (!latest) {
        lines.push('No programme ingested yet, so nothing can be measured against a date.');
      } else {
        const s = latest.programme.stats;
        const position = contractPosition({
          contract: config.contract ?? {},
          programme: latest.programme,
          events: await readYaml(paths.events),
          rfi: await readYaml(paths.rfi),
          submittals: await readYaml(paths.submittals),
          asOf: today(),
        });

        lines.push(`Forecast completion *${formatHuman(s.forecastFinish)}*`);
        if (position.damages && position.damages.days > 0) {
          lines.push(
            `🔴 ${position.damages.days} days beyond the contract date` +
              (position.damages.amount
                ? ` — ${formatMoney(position.damages.amount, position.damages.currency)} at stake if not excused`
                : ''),
          );
        } else if (config.contract?.completionDate) {
          lines.push(`Inside the contract date of ${formatHuman(config.contract.completionDate)}`);
        }
        lines.push(`${s.complete}/${s.activityCount} activities complete · ${s.criticalCount} critical`);

        // Contract exposures first: they are the ones with a deadline attached.
        const running = position.exposures.filter((e) => e.kind !== 'damages').slice(0, 3);
        if (running.length) {
          lines.push('', '*Running against you*');
          for (const item of running) lines.push(`• ${item.title}`);
        }
      }

      const { open } = await runAlerts(project, { commit: false });
      const urgent = open.filter((a) => a.severity === 'critical' || a.severity === 'high');
      if (urgent.length) {
        lines.push('', `*Flagged* — ${urgent.length}`);
        for (const alert of urgent.slice(0, 4)) lines.push(`• ${alert.title}`);
      }

      const waiting = await openItems(project);
      if (waiting.length) {
        lines.push('', `*Waiting on someone else* — ${waiting.length}`);
        for (const item of waiting.slice(0, 4)) {
          lines.push(`• \`${item.ref}\` ${item.subject} — ${item.owner ?? 'unassigned'}`);
        }
      }

      if (lines.length === 2) lines.push('Nothing needs you today.');

      await tg.send(
        chatId,
        lines.join('\n'),
        keyboard([
          [
            { label: '🎙 Site update', send: '/update' },
            { label: '📄 Report', send: '/report' },
          ],
          [
            { label: '📜 Contract', send: '/contract' },
            { label: '📮 All open items', send: '/open' },
          ],
        ]),
      );
      return true;
    }

    /**
     * What the agent believes the contract says, and where it currently bites.
     *
     * Also states which terms are not configured - a term that is not set is not
     * watched, and that has to be visible rather than looking like all-clear.
     */
    case '/contract': {
      if (!project) return true;
      const paths = projectPaths(project);
      const config = (await readYaml(paths.config)) ?? {};
      const latest = await loadLatestProgramme(project);

      const position = contractPosition({
        contract: config.contract ?? {},
        programme: latest?.programme ?? null,
        events: await readYaml(paths.events),
        rfi: await readYaml(paths.rfi),
        submittals: await readYaml(paths.submittals),
        asOf: today(),
      });

      for (const part of chunk(formatContract(project, position, { asOf: today() }))) {
        await tg.send(chatId, part);
      }
      return true;
    }

    case '/status': {
      if (!project) return true;
      const latest = await loadLatestProgramme(project);
      if (!latest) {
        await tg.send(chatId, `No programme ingested for *${project}* yet.`);
        return true;
      }
      const { programme } = latest;
      const s = programme.stats;
      await tg.send(
        chatId,
        [
          `*${project}* — status`,
          '',
          `Data date: ${formatHuman(programme.project.dataDate)}`,
          `Forecast completion: *${formatHuman(s.forecastFinish)}*`,
          '',
          `${s.complete}/${s.activityCount} activities complete, ${s.inProgress} in progress`,
          `${s.criticalCount} activities on the critical path`,
        ].join('\n'),
      );
      return true;
    }

    case '/ask': {
      if (!project) return true;
      const question = args.join(' ').trim();
      if (!question) {
        await tg.send(chatId, 'Ask me something — `/ask when did we first raise the block shortage?`');
        return true;
      }
      await handleAsk(tg, chatId, project, question, state);
      return true;
    }

    case '/open': {
      if (!project) return true;
      const items = await openItems(project);

      if (items.length === 0) {
        await tg.send(chatId, `*${project}* — nothing outstanding with anyone.`);
        return true;
      }

      const lines = [`*${project}* — ${items.length} item${items.length === 1 ? '' : 's'} with someone else`, ''];
      for (const item of items) {
        const when =
          item.daysRemaining === null
            ? item.daysOpen !== null
              ? `open ${item.daysOpen}d`
              : 'no date'
            : item.daysRemaining < 0
              ? `*${Math.abs(item.daysRemaining)}d overdue*`
              : `due in ${item.daysRemaining}d`;
        lines.push(`\`${item.ref}\` ${item.subject}`);
        lines.push(`   ${item.owner ?? 'unassigned'} · ${when}`);
      }
      lines.push('');
      lines.push('`/nudge REF` to draft a chase letter.');

      for (const part of chunk(lines.join('\n'))) await tg.send(chatId, part);
      return true;
    }

    case '/nudge': {
      if (!project) return true;
      const ref = args[0];
      if (!ref) {
        await tg.send(chatId, 'Which one? `/nudge DEC-001`. `/open` lists them.');
        return true;
      }

      const brand = await loadBrand(project);
      const draft = await writeChaseDraft(project, ref, { brand });

      if (!draft) {
        await tg.send(chatId, `No entry with reference \`${ref}\` in any register.`);
        return true;
      }

      await commitLedger([draft.file], `correspondence(${project}): chase draft for ${draft.entry.ref}`);
      await tg.sendDocument(
        chatId,
        path.basename(draft.file),
        draft.body,
        `Draft chase for ${draft.entry.ref}. Review it, then send it yourself.`,
      );

      if (draft.missing.length > 0) {
        await tg.send(
          chatId,
          `The record is thin, so the draft leaves things out:\n${draft.missing.map((m) => `- ${m}`).join('\n')}`,
        );
      }
      return true;
    }

    case '/alerts': {
      if (!project) return true;
      // On demand, list everything open - including the quiet ones that were
      // deliberately not re-sent this morning.
      const result = await runAlerts(project);
      for (const part of chunk(formatOpenAlerts(project, result.open, { asOf: result.asOf }))) {
        await tg.send(chatId, part);
      }
      return true;
    }

    case '/report': {
      if (!project) return true;
      await tg.send(chatId, `Building this week's report for *${project}*…`);

      try {
        const result = await generateWeeklyReport(project, { pdf: true });
        const { readFile } = await import('node:fs/promises');
        const file = result.pdf?.file ?? result.htmlFile;

        // The HTML is a complete, self-contained report - it opens in any browser
        // and prints to PDF. So a missing browser costs a step, never the report.
        const caption = result.pdf
          ? `Weekly report no. ${result.model.meta.reportNo}. Review it, then issue it yourself.`
          : `Weekly report no. ${result.model.meta.reportNo}, as HTML — open it and print to PDF (A4, background graphics on).`;

        await tg.sendDocument(chatId, path.basename(file), await readFile(file), caption);

        if (result.pdfError) {
          await tg.send(
            chatId,
            `_No PDF this time: ${summarisePdfError(result.pdfError)}_\n\n` +
              'Once that is done, `/report` gives you the PDF again.',
          );
        }

        const other = result.warnings.filter((w) => !w.startsWith('PDF not rendered'));
        if (other.length > 0) {
          await tg.send(chatId, `Before this goes to a client:\n${other.map((w) => `- ${w}`).join('\n')}`);
        }
      } catch (error) {
        await tg.send(chatId, `Could not build the report: ${error.message.split('\n')[0]}`);
      }
      return true;
    }

    case '/diff': {
      if (!project) return true;
      const pair = await loadLastTwoProgrammes(project);
      if (!pair) {
        await tg.send(chatId, `Need two ingested programmes to diff. Only one (or none) so far.`);
        return true;
      }
      const diff = diffProgrammes(pair.previous.programme, pair.current.programme);
      const report = renderDiff(diff);

      const paths = projectPaths(project);
      const file = path.join(paths.reports, `${today()}-programme-diff.md`);
      await ensureDir(paths.reports);
      await writeFile(file, report, 'utf8');
      await commitLedger([file], `report(${project}): programme diff ${diff.from.dataDate} → ${diff.to.dataDate}`);

      const headline = [
        `*${project}* — programme change ${diff.from.dataDate} → ${diff.to.dataDate}`,
        '',
        diff.completionShiftDays
          ? `Completion moved *${Math.abs(diff.completionShiftDays)}d ${diff.completionShiftDays > 0 ? 'later' : 'earlier'}*.`
          : 'Completion unchanged.',
        '',
        ...(diff.redFlags.length ? diff.redFlags.map((f) => `⚠️ ${f}`) : ['No red flags.']),
      ].join('\n');

      await tg.send(chatId, headline);
      await tg.sendDocument(chatId, path.basename(file), report, 'Full change report');
      return true;
    }

    case '/health': {
      if (!project) return true;
      const latest = await loadLatestProgramme(project);
      if (!latest) return true;
      const health = checkProgrammeHealth(latest.programme);
      const report = renderHealth(health);
      await tg.send(
        chatId,
        `*${project}* — ${health.verdict}\n\n${health.failedNames.map((n) => `❌ ${n}`).join('\n') || 'All checks pass.'}`,
      );
      await tg.sendDocument(chatId, `${today()}-schedule-health.md`, report, 'DCMA 14-point detail');
      return true;
    }

    case '/lookahead': {
      if (!project) return true;
      const latest = await loadLatestProgramme(project);
      if (!latest) return true;
      const paths = projectPaths(project);
      const config = (await readYaml(paths.config)) ?? {};
      const days = Number(args[0]) || config.chase?.lookaheadDays || 14;
      const result = computeExceptions(latest.programme, {
        asOf: today(),
        config: { ...(config.chase ?? {}), lookaheadDays: days },
        progress: await readYaml(paths.progress),
        limit: 20,
      });
      for (const part of chunk(renderExceptions(result, { projectCode: project }))) {
        await tg.send(chatId, part);
      }
      return true;
    }

    default:
      return false;
  }
}

async function handleMessage(tg, message, state) {
  const chatId = message.chat.id;

  const author = authorOf(message);

  if (!isAuthorised(chatId, author.id)) {
    // Say nothing useful to an unknown chat, but make the chat id visible in
    // the log so you can allowlist yourself on first run.
    console.warn(`[bot] ignoring message from unauthorised chat ${chatId}`);
    return;
  }

  const text = message.text ?? message.caption ?? '';

  if (message.voice || message.audio) {
    await handleVoice(tg, chatId, message, state, author);
    return;
  }

  if (message.photo) {
    await handlePhoto(tg, chatId, message, state, author);
    return;
  }

  if (message.document) {
    await handleDocument(tg, chatId, message, state, author);
    return;
  }

  if (text.startsWith('/')) {
    const handled = await handleCommand(tg, chatId, text, state, author);
    if (!handled) await tg.send(chatId, `Unknown command. ${HELP}`);
    return;
  }

  const project = await resolveProject(state, chatId);
  if (!project) {
    await tg.send(chatId, 'No project set. `/projects` to see what is available.');
    return;
  }

  // An outstanding "who caused it" question takes precedence over everything.
  const pending = state.chats?.[chatId]?.pendingEvent;
  if (pending) {
    await resolvePendingEvent(tg, chatId, pending, text, state);
    return;
  }

  // A leading "?" marks an explicit question. Everything else stays routed to the
  // chase answer, so an ordinary message can never silently cost money.
  if (text.trimStart().startsWith('?')) {
    await handleAsk(tg, chatId, project, text.trim().slice(1).trim(), state);
    return;
  }

  // Not a command - treat as an answer to the chase question on the table.
  const session = await loadSession(project, author);
  if (!session || session.cleared) {
    await tg.send(chatId, 'No chase in progress. `/chase` to start one, or `/help` for what I can do.');
    return;
  }

  const result = await answerChase(project, text, { author });
  await tg.send(chatId, result.message, result.buttons ? keyboard(result.buttons) : {});

  if (result.done) {
    const summary = await finishChase(project, null, { author });
    await tg.send(chatId, summary.message);
    if (summary.p6) {
      const { readFile } = await import('node:fs/promises');
      await tg.sendDocument(
        chatId,
        path.basename(summary.p6.file),
        await readFile(summary.p6.file),
        'Import into P6 and review before saving.',
      );
    }
  }
}

/**
 * Answer a question from the ledger.
 *
 * Each call costs real money, so there is a per-query cap (passed to the CLI) and a
 * daily ceiling tracked here. A runaway loop on an unattended bot should cost a few
 * dollars, not a few hundred.
 */
async function handleAsk(tg, chatId, project, question, state) {
  const dailyCapUsd = Number(process.env.PM_CLAUDE_DAILY_USD) || 5;
  const day = today();

  state.askSpend ??= {};
  const spentToday = state.askSpend[day] ?? 0;

  if (spentToday >= dailyCapUsd) {
    await tg.send(
      chatId,
      `Daily question budget of $${dailyCapUsd.toFixed(2)} is spent ($${spentToday.toFixed(2)} today). ` +
        `Raise PM_CLAUDE_DAILY_USD if that is too tight.`,
    );
    return;
  }

  await tg.send(chatId, '_Reading the project record…_');
  const result = await askLedger(project, question);

  if (!result.ok) {
    await tg.send(chatId, `Could not answer that: ${result.error}`);
    return;
  }

  if (result.costUsd) {
    state.askSpend[day] = spentToday + result.costUsd;
    // Keep only the current day; this is a budget guard, not an audit trail.
    state.askSpend = { [day]: state.askSpend[day] };
    await writeState(state);
  }

  for (const part of chunk(result.result)) await tg.send(chatId, part);
}

/**
 * A voice note becomes a dated site diary entry.
 *
 * Whatever else fails, the audio is filed and the transcript reaches the diary -
 * see diary.js. The one thing this must not do is infer who caused a delay, so a
 * detected delay ends with a question rather than a conclusion.
 */
async function handleVoice(tg, chatId, message, state, author) {
  const project = await resolveProject(state, chatId);
  if (!project) {
    await tg.send(chatId, 'No project set. `/projects` to see what is available.');
    return;
  }

  const media = message.voice ?? message.audio;
  await tg.send(chatId, '_Transcribing…_');

  const buffer = await tg.download(media.file_id);
  const result = await ingestVoiceNote(project, {
    buffer,
    extension: media.mime_type === 'audio/mpeg' ? '.mp3' : '.ogg',
    caption: message.caption ?? null,
    author,
  });

  if (!result.ok) {
    // Voice transcription being switched off is a configuration choice, not a
    // fault, and should not be reported as one.
    await tg.send(
      chatId,
      result.configured
        ? `The audio is filed as evidence, but transcription failed.\n\n${result.error}\n\nSend it as text and it goes straight into the diary.`
        : `Filed the recording as evidence. Voice transcription is switched off, so send me the update as text and it goes straight into the diary.`,
    );
    return;
  }

  const summary = [`Recorded to the site diary for today.`, ''];
  if (result.structured) {
    const s = result.structured;
    const parts = [];
    if (s.weather) parts.push(`weather: ${s.weather}`);
    if (s.manpower?.length) parts.push(`${s.manpower.length} trade(s) on site`);
    if (s.works?.length) parts.push(`${s.works.length} work item(s)`);
    if (s.instructions?.length) parts.push(`${s.instructions.length} instruction(s)`);
    if (parts.length) summary.push(parts.join(' · '));
  } else {
    summary.push('_Structuring was unavailable, so the transcript went in verbatim._');
  }

  await tg.send(chatId, summary.join('\n'));

  if (result.event) {
    state.chats ??= {};
    state.chats[chatId] = {
      ...(state.chats[chatId] ?? {}),
      pendingEvent: { project, ref: result.event.ref },
    };
    await writeState(state);

    await tg.send(
      chatId,
      `I heard something that sounds like a delay, and logged it as *${result.event.ref}*.\n\n` +
        `Was it *client/consultant-caused*, *our own/supplier*, or *neutral* (weather etc.)? ` +
        `It decides whether this supports a claim later, so I will not guess.`,
      keyboard(RESPONSIBILITY_BUTTONS),
    );
  }
}

/** Apply a responsibility answer to an event raised from a voice note. */
async function resolvePendingEvent(tg, chatId, pending, text, state) {
  const paths = projectPaths(pending.project);
  const events = await readYaml(paths.events);
  const entry = entriesOf(events).find((e) => e.ref === pending.ref);

  if (entry) {
    entry.responsibility = classifyResponsibility(text);
    entry.clarification = text;

    // Same rule as the chase loop: the notice clock starts from awareness
    // regardless of fault, and it is the clock most claims are lost on.
    const config = (await readYaml(paths.config)) ?? {};
    const noticeDays = config.contract?.delayNoticeDays ?? null;

    if (noticeDays && entry.responsibility !== 'contractor') {
      entry.noticeDeadline = addDays(entry.date, noticeDays);
      entry.noticeBasis = `${noticeDays} days from awareness (${entry.date}) per project.yaml contract.delayNoticeDays`;
    }

    await writeYaml(paths.events, events);
    await commitLedger([paths.events], `ledger(${pending.project}): classify ${pending.ref} as ${entry.responsibility}`);
  }

  delete state.chats[chatId].pendingEvent;
  await writeState(state);

  await tg.send(
    chatId,
    entry?.noticeDeadline
      ? `Logged as *${entry.responsibility}*.\n\n📄 Notice for ${pending.ref} due by *${formatHuman(entry.noticeDeadline)}*.\n\n_Check the clause before issuing. I draft; you send._`
      : `Logged as *${entry?.responsibility ?? 'unclassified'}*.`,
  );
}

/**
 * A document sent to the bot from anywhere lands in the Ledger on the Mac mini.
 *
 * This is the whole answer to "the machine is in Dubai and I am not": send the
 * contract from your phone and it is filed, hashed and committed.
 */
async function handleDocument(tg, chatId, message, state, author) {
  const project = await resolveProject(state, chatId);
  if (!project) {
    await tg.send(chatId, 'No project set. `/projects` to see what is available.');
    return;
  }

  const doc = message.document;
  const caption = message.caption ?? '';

  // Telegram's bot API will not hand over a file above 20 MB. A drawing set will
  // exceed that, so say what to do rather than failing obscurely.
  if (doc.file_size && doc.file_size > 20 * 1024 * 1024) {
    await tg.send(
      chatId,
      `\`${doc.file_name}\` is ${(doc.file_size / 1024 / 1024).toFixed(0)} MB. Telegram will not let me download anything over 20 MB.\n\n` +
        `Drop it in the inbox folder instead — it syncs to the Mac mini and gets filed the same way.`,
    );
    return;
  }

  await tg.send(chatId, '_Filing…_');

  const result = await fileDocument(project, {
    buffer: await tg.download(doc.file_id),
    filename: doc.file_name ?? 'document',
    hint: caption,
    note: caption || null,
    author,
    via: 'telegram',
  });

  if (result.status === 'duplicate') {
    await tg.send(
      chatId,
      `Already have that exact file — filed ${result.of.date} as \`${result.of.file}\`. Nothing added.`,
    );
    return;
  }

  await tg.send(
    chatId,
    [
      `Filed as *${result.category}*.`,
      '',
      `\`${result.record.file}\``,
      `sha256 \`${result.record.sha256.slice(0, 16)}…\``,
      '',
      caption
        ? ''
        : '_Tip: add a caption like "contract" or "drawing" and I file it in the right folder._',
    ]
      .filter(Boolean)
      .join('\n'),
  );
}

/** Photos are evidence. File them against the project, dated, with the caption. */
async function handlePhoto(tg, chatId, message, state, author) {
  const project = await resolveProject(state, chatId);
  if (!project) return;

  const paths = projectPaths(project);
  const day = today();
  const dir = path.join(paths.photos, day);
  await ensureDir(dir);

  // Telegram sends several resolutions; the last is the largest.
  const photo = message.photo.at(-1);
  const buffer = await tg.download(photo.file_id);
  const existing = await listFiles(dir, '.jpg');
  const name = `${day}-${String(existing.length + 1).padStart(3, '0')}.jpg`;
  const file = path.join(dir, name);
  await writeFile(file, buffer);

  const caption = message.caption ?? '';
  const indexFile = path.join(paths.photos, 'index.yaml');
  const index = (await readYaml(indexFile)) ?? { entries: [] };
  index.entries.push({
    file: path.relative(paths.root, file),
    date: day,
    caption: caption || null,
    // Activity linkage comes from the caption when you write one like
    // "A-1240 level 3 blockwork east side".
    activity: /\b([A-Z]{1,4}-?\d{3,5})\b/.exec(caption)?.[1] ?? null,
    takenBy: author?.name ?? null,
    takenById: author?.id ?? null,
    receivedAt: new Date().toISOString(),
  });
  await writeYaml(indexFile, index, { header: 'Photo evidence index' });

  await commitLedger([file, indexFile], `evidence(${project}): photo ${name}`);

  await tg.send(
    chatId,
    caption
      ? `Filed as \`${name}\`${/\b([A-Z]{1,4}-?\d{3,5})\b/.test(caption) ? ' and linked to the activity in the caption' : ''}.`
      : `Filed as \`${name}\`. Add a caption with the activity code next time and I will link it.`,
  );
}

/**
 * Turn a button press into the message it stands for.
 *
 * Every button carries "t:" plus the text a person would have typed, so a tap
 * runs through handleMessage exactly like typing - same authorisation, same
 * attribution, same record. The press is acknowledged and the buttons removed
 * first, so a double-tap cannot answer the same question twice.
 */
export async function asMessage(tg, callbackQuery) {
  if (!callbackQuery) return null;
  await tg.answerCallbackQuery(callbackQuery.id);

  const source = callbackQuery.message;
  const data = callbackQuery.data ?? '';
  if (!source?.chat || !data.startsWith('t:')) return null;

  await tg.clearButtons(source.chat.id, source.message_id);
  return { chat: source.chat, from: callbackQuery.from, text: data.slice(2) };
}

export async function runBot({ token = process.env.TELEGRAM_BOT_TOKEN } = {}) {
  const tg = new Telegram(token);
  const me = await tg.call('getMe');
  console.log(`[bot] running as @${me.username}; ledger root ${ledgerRoot()}`);

  // Populate Telegram's own Menu button. Not cosmetic: it is the difference
  // between remembering a command at a site gate and tapping one from a list.
  // A failure here must never stop the bot - the commands all still work typed.
  try {
    await tg.call('setMyCommands', { commands: COMMAND_MENU });
    await tg.call('setChatMenuButton', { menu_button: { type: 'commands' } });
    console.log(`[bot] command menu registered (${COMMAND_MENU.length} entries)`);
  } catch (error) {
    console.warn('[bot] could not register the command menu:', error.message);
  }

  if (!process.env.TELEGRAM_ALLOWED_CHAT_IDS) {
    console.warn(
      '[bot] TELEGRAM_ALLOWED_CHAT_IDS is not set — every message will be ignored. ' +
        'Message the bot once and copy the chat id from the log below.',
    );
  }

  for (;;) {
    try {
      const updates = await tg.getUpdates();
      for (const update of updates) {
        const message = update.message ?? (await asMessage(tg, update.callback_query));
        if (!message) continue;
        const state = await readState();
        try {
          await handleMessage(tg, message, state);
        } catch (error) {
          console.error('[bot] handler error:', error);
          if (isAuthorised(message.chat.id, message.from?.id)) {
            await tg
              .send(message.chat.id, `Something broke handling that: ${error.message}`)
              .catch(() => {});
          }
        }
      }
    } catch (error) {
      // Network blips and Telegram 5xx are routine over months of uptime.
      console.error('[bot] poll error, retrying in 5s:', error.message);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

/**
 * Where a scheduled push for this project should go.
 *
 * `project.yaml` may name a chat, so a project with its own group does not spray
 * every other project's alerts at it. That chat must still be in the allowlist -
 * a per-project setting can narrow the audience but never widen it, or editing a
 * yaml file would be enough to exfiltrate a ledger.
 */
export async function resolveChatIds(projectCode) {
  const allowed = (process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (allowed.length === 0) throw new Error('TELEGRAM_ALLOWED_CHAT_IDS is not set');

  const config = (await readYaml(projectPaths(projectCode).config)) ?? {};
  const preferred = config.telegram?.chatId;

  if (preferred && allowed.includes(String(preferred))) return [String(preferred)];

  if (preferred) {
    console.warn(
      `[bot] project.yaml for ${projectCode} names chat ${preferred}, which is not in TELEGRAM_ALLOWED_CHAT_IDS - ignoring it.`,
    );
  }

  return allowed;
}

/** Used by the cron entry point to push the morning chase without a /chase. */
export async function pushChase(projectCode, { token = process.env.TELEGRAM_BOT_TOKEN } = {}) {
  const chatIds = await resolveChatIds(projectCode);
  const tg = new Telegram(token);
  const result = await startChase(projectCode);

  for (const chatId of chatIds) {
    await tg.send(chatId, result.message);
    if (result.question) {
      await tg.send(chatId, `*1/${result.session.queue.length}* — ${result.question}`);
    }
  }

  return result;
}

/**
 * Scheduled alert run. Sends nothing on a quiet day, which is the whole point -
 * the value of an alert is destroyed by the ones that did not need sending.
 */
export async function pushAlerts(projectCode, { token = process.env.TELEGRAM_BOT_TOKEN, asOf } = {}) {
  const result = await runAlerts(projectCode, { asOf });

  if (result.toSend.length === 0) return result;

  const chatIds = await resolveChatIds(projectCode);
  const tg = new Telegram(token);
  const message = formatAlertBatch(projectCode, result.toSend, { asOf: result.asOf });

  for (const chatId of chatIds) {
    for (const part of chunk(message)) await tg.send(chatId, part);
  }

  return result;
}

/**
 * Test seam.
 *
 * A conversation is the product here, so the parts worth checking are the ones
 * that decide what comes back - not the parts that talk to Telegram. Exposing
 * the command handler lets a test drive a whole exchange against a fake client.
 */
export const _internals = { handleCommand, MENU_ROWS, MORE_ROWS };
