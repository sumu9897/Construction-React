import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = await mkdtemp(path.join(tmpdir(), 'pm-agent-mspdi-'));
process.env.LEDGER_ROOT = path.join(root, 'projects');

const { scaffoldProject } = await import('../src/ledger/scaffold.js');
const { ingestXer, loadLatestProgramme } = await import('../src/programme/ingest.js');
const { projectPaths } = await import('../src/ledger/paths.js');
const { makeMspdi } = await import('./fixtures/make-mspdi.js');
const { BASE_PROGRAMME } = await import('./fixtures/make-xer.js');

const CODE = 'MSP-001';

test.after(() => rm(root, { recursive: true, force: true }));

test('pm ingest accepts an MS Project XML end to end', async () => {
  await scaffoldProject(CODE, { name: 'MSP Integration' });

  const file = path.join(root, 'bcharreh-update.xml');
  await writeFile(file, makeMspdi(BASE_PROGRAMME), 'utf8');

  const { programme, parsedFile } = await ingestXer(CODE, file);
  assert.equal(programme.stats.activityCount, 6);
  assert.equal(programme.project.dataDateDay, '2026-07-01');
  assert.match(parsedFile, /2026-07-01\.json$/);

  // The archive keeps the source format's own extension.
  const archived = await readdir(projectPaths(CODE).xer);
  assert.deepEqual(archived, ['2026-07-01.xml']);

  // And downstream loading is oblivious to which scheduler produced it.
  const latest = await loadLatestProgramme(CODE);
  assert.equal(latest.programme.stats.activityCount, 6);
});

test('an unknown extension is refused with the export instructions', async () => {
  const file = path.join(root, 'plan.mpp');
  await writeFile(file, 'binary junk', 'utf8');
  await assert.rejects(() => ingestXer(CODE, file), /Save As → XML/);
});
