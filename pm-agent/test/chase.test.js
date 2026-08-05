import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// ledgerRoot() reads the env on every call, so this must be set before the
// ledger modules are used - not before they are imported.
const root = await mkdtemp(path.join(tmpdir(), 'pm-agent-test-'));
process.env.LEDGER_ROOT = path.join(root, 'projects');

const { scaffoldProject } = await import('../src/ledger/scaffold.js');
const { ingestXer } = await import('../src/programme/ingest.js');
const { startChase, answerChase, finishChase, loadSession } = await import('../src/bot/chase.js');
const { projectPaths } = await import('../src/ledger/paths.js');
const { readYaml } = await import('../src/ledger/store.js');
const { makeXer, BASE_PROGRAMME } = await import('./fixtures/make-xer.js');

const CODE = 'IT-001';

test.after(() => rm(root, { recursive: true, force: true }));

test('scaffolds a project ledger with empty registers', async () => {
  const paths = await scaffoldProject(CODE, { name: 'Integration Test' });
  const rfi = await readYaml(paths.rfi);
  assert.deepEqual(rfi, { nextRef: 1, entries: [] });

  const config = await readYaml(paths.config);
  assert.equal(config.code, CODE);
  assert.equal(config.contract.delayNoticeDays, 28);
});

test('ingests an XER and archives the parsed snapshot by data date', async () => {
  const xer = path.join(root, 'base.xer');
  await writeFile(xer, makeXer(BASE_PROGRAMME), 'latin1');

  const { programme, parsedFile } = await ingestXer(CODE, xer);
  assert.equal(programme.stats.activityCount, 6);
  assert.match(parsedFile, /2026-07-01\.json$/);
});

test('a full chase writes progress, a delay event, the diary and a P6 update', async () => {
  const start = await startChase(CODE, { asOf: '2026-07-10' });
  assert.equal(start.status, 'started');
  assert.ok(start.session.queue.length > 0);

  // Answer every question in the queue, with one delay disclosed.
  let replies = [
    'started 6 july, about 40% done, we lost time waiting for the consultant to approve the shop drawings',
    'the consultant',
  ];
  for (const reply of replies) {
    const result = await answerChase(CODE, reply);
    assert.ok(result.message);
  }

  // Clear the rest of the queue so the session closes deterministically.
  for (;;) {
    const result = await answerChase(CODE, 'skip');
    if (result.done || result.status === 'no-session') break;
  }

  const summary = await finishChase(CODE);
  const paths = projectPaths(CODE);

  const progress = await readYaml(paths.progress);
  const first = Object.values(progress.activities)[0];
  assert.equal(first.percentComplete, 40);
  assert.equal(first.actualStart, '2026-07-06');
  assert.equal(first.source, 'telegram-chase');

  const events = await readYaml(paths.events);
  assert.equal(events.entries.length, 1);
  assert.equal(events.entries[0].responsibility, 'employer');
  // 28 days from awareness on 10 July.
  assert.equal(events.entries[0].noticeDeadline, '2026-08-07');
  assert.match(events.entries[0].noticeBasis, /28 days from awareness/);

  assert.ok(summary.p6, 'a P6 update file should be produced');
  assert.equal(summary.noticeDeadlines.length, 1);
  assert.match(summary.message, /notice due by/);
});

test('an own-cause delay gets no notice deadline', async () => {
  await startChase(CODE, { asOf: '2026-07-11' });
  await answerChase(CODE, 'still going, 50%, our crane broke down');
  await answerChase(CODE, 'ours, the plant is on us');

  for (;;) {
    const result = await answerChase(CODE, 'skip');
    if (result.done || result.status === 'no-session') break;
  }
  const summary = await finishChase(CODE);

  const events = await readYaml(projectPaths(CODE).events);
  const latest = events.entries.at(-1);
  assert.equal(latest.responsibility, 'contractor');
  assert.equal(latest.noticeDeadline, null);
  assert.equal(summary.noticeDeadlines.length, 0);
});

test('two people can be chased at once without clobbering each other', async () => {
  // Sessions used to be keyed by project, so a second person answering would
  // silently overwrite the first person's answers.
  const ali = { id: 101, name: 'Ali Mansour' };
  const sara = { id: 202, name: 'Sara Khoury' };

  const first = await startChase(CODE, { asOf: '2026-07-15', author: ali });
  const second = await startChase(CODE, { asOf: '2026-07-15', author: sara });

  assert.equal(first.status, 'started');
  assert.equal(second.status, 'started');

  // Interleave, the way two people actually would.
  await answerChase(CODE, 'skip', { author: ali });
  await answerChase(CODE, 'skip', { author: sara });
  await answerChase(CODE, 'started 14 july, 25% done', { author: ali });

  const aliSession = await loadSession(CODE, ali);
  const saraSession = await loadSession(CODE, sara);

  assert.equal(aliSession.answers.length, 1, "Ali's answer survived");
  assert.equal(saraSession.answers.length, 0, "Sara's session is untouched");
  assert.equal(aliSession.author.name, 'Ali Mansour');
  assert.equal(saraSession.index, 1, 'each session tracks its own position');
});

test('the ledger records who reported each update, not just how it arrived', async () => {
  const author = { id: 303, name: 'Omar Haddad' };
  await startChase(CODE, { asOf: '2026-07-16', author });
  await answerChase(CODE, 'started 15 july, 30% done', { author });

  for (;;) {
    const result = await answerChase(CODE, 'skip', { author });
    if (result.done || result.status === 'no-session') break;
  }
  await finishChase(CODE, null, { author });

  const progress = await readYaml(projectPaths(CODE).progress);
  const reported = Object.values(progress.activities).filter((a) => a.reportedBy === 'Omar Haddad');
  assert.ok(reported.length > 0, 'progress carries the reporter');

  const { readFile } = await import('node:fs/promises');
  const diary = await readFile(projectPaths(CODE).diary, 'utf8');
  assert.match(diary, /reported by Omar Haddad/);
});

test('the diary keeps the exact words that were said', async () => {
  const { readFile } = await import('node:fs/promises');
  const diary = await readFile(projectPaths(CODE).diary, 'utf8');
  assert.match(diary, /## 2026-07-10/);
  // Verbatim quotes are what make the diary usable as contemporaneous evidence.
  assert.match(diary, /waiting for the consultant to approve the shop drawings/);
});

test('re-running the chase the same day does not re-ask what was answered', async () => {
  const again = await startChase(CODE, { asOf: '2026-07-10' });
  const asked = again.session?.queue.map((q) => q.code) ?? [];
  const progress = await readYaml(projectPaths(CODE).progress);
  const answeredToday = Object.entries(progress.activities)
    .filter(([, entry]) => entry.updatedAt?.startsWith('2026-07-10'))
    .map(([code]) => code);

  for (const code of answeredToday) {
    assert.ok(!asked.includes(code), `${code} was answered today and should not be re-asked`);
  }
});
