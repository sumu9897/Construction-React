import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = await mkdtemp(path.join(tmpdir(), 'pm-diary-test-'));
process.env.LEDGER_ROOT = path.join(root, 'projects');

const { transcribe, transcriberConfigured } = await import('../src/bot/transcribe.js');
const { renderDiaryEntry, ingestVoiceNote } = await import('../src/bot/diary.js');
const { scaffoldProject } = await import('../src/ledger/scaffold.js');
const { projectPaths } = await import('../src/ledger/paths.js');
const { readYaml } = await import('../src/ledger/store.js');

const CODE = 'VOICE-01';

test.after(() => rm(root, { recursive: true, force: true }));

// --- rendering -------------------------------------------------------------

const structured = {
  weather: 'hot, 44C, high humidity',
  manpower: [
    { trade: 'blocklayers', count: 12 },
    { trade: 'MEP', count: 6 },
  ],
  plant: ['tower crane', '2x concrete pump'],
  works: [
    { location: 'Level 3 east', description: 'blockwork to grid 6', activity: 'A-1240' },
    { description: 'slab prep' },
  ],
  delays: ['block delivery arrived short by 200'],
  instructions: ['Engineer instructed a change to the riser layout'],
  visitors: ['Employer rep, 10:00'],
};

test('a structured entry renders every section that has content', () => {
  const entry = renderDiaryEntry({
    day: '2026-08-05',
    transcript: 'raw words here',
    structured,
    audioFile: '04-evidence/voice/2026-08-05/x.ogg',
  });

  assert.match(entry, /## 2026-08-05/);
  assert.match(entry, /\*\*Weather:\*\* hot, 44C/);
  assert.match(entry, /18 total/, 'manpower is totalled');
  assert.match(entry, /blocklayers 12, MEP 6/);
  assert.match(entry, /tower crane/);
  assert.match(entry, /Level 3 east: blockwork to grid 6 \(A-1240\)/);
  assert.match(entry, /block delivery arrived short/);
  assert.match(entry, /Engineer instructed/);
});

test('sections with nothing in them are omitted, not rendered empty', () => {
  const entry = renderDiaryEntry({
    day: '2026-08-05',
    transcript: 'just a quick one',
    structured: { works: [{ description: 'blockwork' }] },
  });

  assert.doesNotMatch(entry, /Weather/);
  assert.doesNotMatch(entry, /Manpower/);
  assert.doesNotMatch(entry, /Visitors/);
  assert.match(entry, /Works executed/);
});

test('the verbatim transcript is always present, structured or not', () => {
  // It is the primary record; the structuring is a convenience over the top.
  const withStructure = renderDiaryEntry({ day: '2026-08-05', transcript: 'exact words', structured });
  const without = renderDiaryEntry({ day: '2026-08-05', transcript: 'exact words', structured: null });

  assert.match(withStructure, /> exact words/);
  assert.match(without, /> exact words/);
  assert.match(without, /Transcript \(not structured\)/);
});

// --- transcription ---------------------------------------------------------

test('with no transcriber configured, it says so rather than failing obscurely', async () => {
  const previous = process.env.PM_TRANSCRIBE_CMD;
  delete process.env.PM_TRANSCRIBE_CMD;

  const result = await transcribe('/tmp/whatever.wav');
  assert.equal(result.ok, false);
  assert.match(result.error, /No transcriber configured/);
  assert.match(result.error, /PM_TRANSCRIBE_CMD/);
  assert.equal(transcriberConfigured(), false);

  if (previous) process.env.PM_TRANSCRIBE_CMD = previous;
});

test('a transcriber that writes to the output file is read correctly', async () => {
  const audio = path.join(root, 'note.wav');
  await writeFile(audio, 'fake audio');

  const result = await transcribe(audio, {
    command: `printf '%s' 'twelve blocklayers on level three today' > {output}`,
    acceptsOgg: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.text, 'twelve blocklayers on level three today');
});

test('a transcriber that prints to stdout is equally valid', async () => {
  const audio = path.join(root, 'note2.wav');
  await writeFile(audio, 'fake audio');

  const result = await transcribe(audio, {
    command: `printf '%s' 'spoken via stdout'`,
    acceptsOgg: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.text, 'spoken via stdout');
});

test('a failing transcriber reports the failure instead of returning empty text', async () => {
  const audio = path.join(root, 'note3.wav');
  await writeFile(audio, 'fake audio');

  const result = await transcribe(audio, { command: 'exit 3', acceptsOgg: true });
  assert.equal(result.ok, false);
  assert.match(result.error, /exit 3/);
});

test('a hung transcriber is killed', async () => {
  const audio = path.join(root, 'note4.wav');
  await writeFile(audio, 'fake audio');

  const result = await transcribe(audio, { command: 'sleep 30', acceptsOgg: true, timeoutMs: 300 });
  assert.equal(result.ok, false);
  assert.match(result.error, /timed out/i);
});

// --- the pipeline ----------------------------------------------------------

test('a voice note becomes a dated diary entry, filed and indexed', async () => {
  await scaffoldProject(CODE, { name: 'Voice Test' });

  process.env.PM_TRANSCRIBE_ACCEPTS_OGG = '1';
  process.env.PM_TRANSCRIBE_CMD = `printf '%s' 'Thursday. Twelve blocklayers on level three east, blockwork up to grid six. Weather hot.' > {output}`;

  const result = await ingestVoiceNote(CODE, {
    buffer: Buffer.from('fake ogg'),
    asOf: '2026-08-05',
    // Structuring needs Claude; keep this test hermetic and free.
    structure: false,
  });

  assert.equal(result.ok, true);

  const paths = projectPaths(CODE);
  const diary = await readFile(paths.diary, 'utf8');
  assert.match(diary, /## 2026-08-05/);
  assert.match(diary, /Twelve blocklayers on level three east/);

  const index = await readYaml(path.join(paths.evidence, 'voice', 'index.yaml'));
  assert.equal(index.entries.length, 1);
  assert.equal(index.entries[0].transcribed, true);
  assert.match(index.entries[0].file, /04-evidence\/voice\/2026-08-05\//);
});

test('a delay heard in a voice note opens an event, unclassified', async () => {
  process.env.PM_TRANSCRIBE_CMD = `printf '%s' 'We are still waiting for the consultant to approve the shop drawings so nothing started on level three.' > {output}`;

  const result = await ingestVoiceNote(CODE, {
    buffer: Buffer.from('fake ogg'),
    asOf: '2026-08-06',
    structure: false,
    author: { id: 991, name: 'Ahmed Hassan' },
  });

  assert.ok(result.event, 'a delay cue should open an event');
  // The whole point: heard, recorded, but never attributed by the machine.
  assert.equal(result.event.responsibility, 'unclassified');
  assert.equal(result.event.responsibilityHint, 'employer-or-consultant');
  assert.equal(result.event.noticeDeadline, null);

  const events = await readYaml(projectPaths(CODE).events);
  const logged = events.entries.at(-1);
  // recordedBy names the person; the channel is separate. "Reported by the site
  // engineer" is far stronger evidence than "reported by voice-note".
  assert.equal(logged.recordedVia, 'voice-note');
  assert.equal(logged.recordedBy, 'Ahmed Hassan');
  assert.equal(logged.recordedById, 991);
});

test('the diary names who recorded the note', async () => {
  process.env.PM_TRANSCRIBE_CMD = `printf '%s' 'Steel deliveries all arrived on time today.' > {output}`;

  await ingestVoiceNote(CODE, {
    buffer: Buffer.from('fake ogg'),
    asOf: '2026-08-09',
    structure: false,
    author: { id: 991, name: 'Ahmed Hassan' },
  });

  const diary = await readFile(projectPaths(CODE).diary, 'utf8');
  assert.match(diary, /voice note from Ahmed Hassan/);

  const index = await readYaml(path.join(projectPaths(CODE).evidence, 'voice', 'index.yaml'));
  assert.equal(index.entries.at(-1).recordedBy, 'Ahmed Hassan');
});

test('an ordinary voice note does not invent a delay event', async () => {
  process.env.PM_TRANSCRIBE_CMD = `printf '%s' 'Good day, blockwork progressed well to grid eight.' > {output}`;

  const result = await ingestVoiceNote(CODE, {
    buffer: Buffer.from('fake ogg'),
    asOf: '2026-08-07',
    structure: false,
  });

  assert.equal(result.event, null);
});

test('when transcription fails the audio is still filed as evidence', async () => {
  // Losing the recording because a parser was unhappy is not acceptable.
  process.env.PM_TRANSCRIBE_CMD = 'exit 1';

  const result = await ingestVoiceNote(CODE, {
    buffer: Buffer.from('fake ogg'),
    asOf: '2026-08-08',
    structure: false,
  });

  assert.equal(result.ok, false);
  assert.ok(result.audioFile);

  const { access } = await import('node:fs/promises');
  await access(result.audioFile); // throws if it was not written

  const index = await readYaml(path.join(projectPaths(CODE).evidence, 'voice', 'index.yaml'));
  const last = index.entries.at(-1);
  assert.equal(last.transcribed, false);
  assert.ok(last.note, 'the reason it could not be transcribed is recorded');
});

test('structuring failure still writes the raw transcript to the diary', async () => {
  // structure: true with a claude binary that does not exist - the structuring
  // step must degrade, not take the record down with it.
  process.env.PM_TRANSCRIBE_CMD = `printf '%s' 'Rambling but real site report for the eleventh.' > {output}`;
  process.env.PM_CLAUDE_BIN = path.join(root, 'no-such-claude');

  const result = await ingestVoiceNote(CODE, {
    buffer: Buffer.from('fake ogg'),
    asOf: '2026-08-11',
  });

  assert.equal(result.ok, true);
  assert.equal(result.structured, null);

  const diary = await readFile(projectPaths(CODE).diary, 'utf8');
  assert.match(diary, /Rambling but real site report for the eleventh/);
  assert.match(diary, /Transcript \(not structured\)/);

  delete process.env.PM_CLAUDE_BIN;
});
