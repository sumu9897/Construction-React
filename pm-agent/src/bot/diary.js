/**
 * Voice note to site diary.
 *
 * Nobody writes a site diary properly at 6pm, but everybody will talk for ninety
 * seconds walking off site. A complete diary series is the foundation of every
 * claim you will ever make, so the capture method has to be the effortless one.
 *
 * **The record is never lost.** If the transcriber is not configured, if it fails,
 * or if the structuring step fails, the raw transcript is still written to the diary,
 * dated and verbatim. A rambling dated transcript is a perfectly valid
 * contemporaneous record; dropping it because a parser was unhappy is not
 * acceptable.
 */

import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { projectPaths } from '../ledger/paths.js';
import { readYaml, writeYaml, appendMarkdown, ensureDir } from '../ledger/store.js';
import { commitLedger } from '../ledger/git.js';
import { transcribe, transcriberConfigured } from './transcribe.js';
import { runClaude } from './ask.js';
import { _internals as replyInternals } from './parseReply.js';
import { today, formatHuman } from '../util/dates.js';

/** What a site diary entry is actually made of. */
export const DIARY_SCHEMA = {
  type: 'object',
  properties: {
    weather: { type: 'string', description: 'Only if mentioned. Otherwise omit.' },
    manpower: {
      type: 'array',
      items: {
        type: 'object',
        properties: { trade: { type: 'string' }, count: { type: 'number' } },
        required: ['trade'],
      },
    },
    plant: { type: 'array', items: { type: 'string' } },
    works: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          location: { type: 'string' },
          description: { type: 'string' },
          activity: { type: 'string', description: 'P6 activity code, only if stated' },
        },
        required: ['description'],
      },
    },
    delays: { type: 'array', items: { type: 'string' } },
    instructions: { type: 'array', items: { type: 'string' } },
    visitors: { type: 'array', items: { type: 'string' } },
  },
};

const STRUCTURE_PROMPT = `Structure this spoken site report into the given schema.

Rules:
- Record ONLY what was actually said. Omit any field that was not mentioned - do not include it as an empty string or a zero.
- Do not infer, tidy up, or complete a half-finished thought.
- Do not assign responsibility for any delay. Record what was said about it and nothing more.
- Keep the speaker's own words and numbers wherever possible.

The spoken report follows.

---
`;

/**
 * Turn a transcript into structured fields. Returns null on any failure, which the
 * caller treats as "write the raw transcript instead".
 */
export async function structureTranscript(transcript, { cwd, ...options } = {}) {
  const result = await runClaude({
    cwd: cwd ?? process.cwd(),
    prompt: `${STRUCTURE_PROMPT}${transcript}`,
    jsonSchema: DIARY_SCHEMA,
    ...options,
  });

  if (!result.ok || !result.parsed) return null;
  return result.parsed;
}

const bullet = (items) => items.map((item) => `  - ${item}`).join('\n');

/** Render a diary entry. Sections with nothing in them are omitted entirely. */
export function renderDiaryEntry({ day, transcript, structured, audioFile, caption, author }) {
  const lines = [`## ${day}`, ''];
  lines.push(
    `Site report recorded by voice note${author?.name ? ` from ${author.name}` : ''}${caption ? ` — ${caption}` : ''}.`,
  );
  lines.push('');

  if (structured) {
    if (structured.weather) lines.push(`- **Weather:** ${structured.weather}`);

    if (structured.manpower?.length) {
      const total = structured.manpower.reduce((sum, m) => sum + (m.count ?? 0), 0);
      const detail = structured.manpower
        .map((m) => `${m.trade}${m.count ? ` ${m.count}` : ''}`)
        .join(', ');
      lines.push(`- **Manpower:**${total ? ` ${total} total —` : ''} ${detail}`);
    }

    if (structured.plant?.length) lines.push(`- **Plant:** ${structured.plant.join(', ')}`);

    if (structured.works?.length) {
      lines.push('- **Works executed:**');
      lines.push(
        bullet(
          structured.works.map(
            (w) =>
              `${w.location ? `${w.location}: ` : ''}${w.description}${w.activity ? ` (${w.activity})` : ''}`,
          ),
        ),
      );
    }

    if (structured.delays?.length) {
      lines.push('- **Delays / disruption:**');
      lines.push(bullet(structured.delays));
    }

    if (structured.instructions?.length) {
      lines.push('- **Instructions received:**');
      lines.push(bullet(structured.instructions));
    }

    if (structured.visitors?.length) lines.push(`- **Visitors:** ${structured.visitors.join(', ')}`);

    lines.push('');
  }

  // The verbatim transcript always appears, structured or not. It is the primary
  // record; the structuring above is a convenience laid over it.
  lines.push(structured ? '**As recorded:**' : '**Transcript (not structured):**');
  lines.push('');
  lines.push(`> ${transcript.replace(/\n+/g, '\n> ')}`);

  if (audioFile) {
    lines.push('');
    lines.push(`_Audio: ${audioFile}_`);
  }

  return lines.join('\n');
}

/**
 * Full pipeline: store the audio, transcribe, structure, write the diary, index it,
 * and flag any delay that was mentioned.
 *
 * @param {string} projectCode
 * @param {{buffer: Buffer, extension?: string, caption?: string, asOf?: string, structure?: boolean}} input
 */
export async function ingestVoiceNote(projectCode, input) {
  const paths = projectPaths(projectCode);
  const day = input.asOf ?? today();
  const author = input.author ?? { id: 'terminal', name: 'terminal' };
  const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, '');

  const dir = path.join(paths.evidence, 'voice', day);
  await ensureDir(dir);

  const audioFile = path.join(dir, `${day}-${stamp}${input.extension ?? '.ogg'}`);
  await writeFile(audioFile, input.buffer);

  const written = [audioFile];
  const relative = path.relative(paths.root, audioFile);

  // 1. Transcribe.
  const transcription = await transcribe(audioFile);

  if (!transcription.ok) {
    // The audio itself is still evidence and is still filed and committed.
    await indexVoiceNote(paths, {
      file: relative,
      date: day,
      caption: input.caption ?? null,
      recordedBy: author.name,
      transcribed: false,
      note: transcription.error,
    });
    written.push(path.join(paths.evidence, 'voice', 'index.yaml'));
    await commitLedger(written, `evidence(${projectCode}): voice note ${path.basename(audioFile)} (not transcribed)`);

    return {
      ok: false,
      audioFile,
      error: transcription.error,
      configured: transcriberConfigured(),
    };
  }

  // 2. Structure it - and carry on regardless if that fails.
  let structured = null;
  if (input.structure !== false) {
    structured = await structureTranscript(transcription.text, { cwd: paths.root });
  }

  // 3. The diary entry. Always written, structured or not.
  const entry = renderDiaryEntry({
    day,
    transcript: transcription.text,
    structured,
    audioFile: relative,
    caption: input.caption,
    author,
  });
  await appendMarkdown(paths.diary, entry);
  written.push(paths.diary);

  // 4. Delay cues, using the same detector as the chase loop. Responsibility is
  //    never inferred - the caller asks.
  const delay = replyInternals.detectDelay(transcription.text);
  let event = null;

  if (delay.detected) {
    const events = (await readYaml(paths.events)) ?? { nextRef: 1, entries: [] };
    events.entries ??= [];
    events.nextRef ??= 1;

    event = {
      ref: `EV-${String(events.nextRef).padStart(3, '0')}`,
      date: day,
      activity: structured?.works?.find((w) => w.activity)?.activity ?? null,
      description: transcription.text,
      responsibility: 'unclassified',
      responsibilityHint: delay.hint,
      clarification: null,
      noticeIssued: false,
      noticeDeadline: null,
      noticeBasis: 'Awaiting responsibility classification',
      // Who said it, not just how it arrived.
      recordedBy: author.name,
      recordedById: author.id,
      recordedVia: 'voice-note',
      recordedAt: new Date().toISOString(),
    };

    events.entries.push(event);
    events.nextRef += 1;
    await writeYaml(paths.events, events);
    written.push(paths.events);
  }

  // 5. Index and commit.
  const transcriptFile = audioFile.replace(/\.[^.]+$/, '.txt');
  await writeFile(transcriptFile, transcription.text, 'utf8');
  written.push(transcriptFile);

  await indexVoiceNote(paths, {
    file: relative,
    transcript: path.relative(paths.root, transcriptFile),
    date: day,
    caption: input.caption ?? null,
    recordedBy: author.name,
    transcribed: true,
    structured: Boolean(structured),
  });
  written.push(path.join(paths.evidence, 'voice', 'index.yaml'));

  const sha = await commitLedger(
    written,
    `diary(${projectCode}): voice note ${day} by ${author.name}${event ? ` — delay event ${event.ref}` : ''}`,
  );

  return {
    ok: true,
    audioFile,
    transcript: transcription.text,
    structured,
    entry,
    event,
    sha,
  };
}

async function indexVoiceNote(paths, record) {
  const file = path.join(paths.evidence, 'voice', 'index.yaml');
  const index = (await readYaml(file)) ?? { entries: [] };
  index.entries ??= [];
  index.entries.push({ ...record, receivedAt: new Date().toISOString() });
  await writeYaml(file, index, { header: 'Voice note evidence index' });
  return file;
}
