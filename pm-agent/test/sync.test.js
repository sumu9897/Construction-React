import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const run = promisify(execFile);
const git = (args, cwd) => run('git', args, { cwd }).then((r) => r.stdout.trim());

const root = await mkdtemp(path.join(tmpdir(), 'pm-sync-test-'));
const { syncLedger } = await import('../src/ledger/sync.js');

test.after(() => rm(root, { recursive: true, force: true }));

/** Two clones of one bare remote - a Mac mini and a laptop. */
async function makeWorkspace(name) {
  const origin = path.join(root, `${name}-origin.git`);
  await git(['init', '--bare', '-b', 'main', '-q', origin]);

  const clone = async (who) => {
    const dir = path.join(root, `${name}-${who}`);
    await git(['clone', '-q', origin, dir]);
    await git(['config', 'user.email', 'test@example.com'], dir);
    await git(['config', 'user.name', 'Test'], dir);
    await git(['checkout', '-qb', 'main'], dir).catch(() => {});
    await mkdir(path.join(dir, 'projects'), { recursive: true });
    return dir;
  };

  return { origin, mini: await clone('mini'), laptop: await clone('laptop') };
}

/** Run a sync with LEDGER_ROOT pointed at one machine's projects folder. */
async function syncAs(dir, options) {
  const previous = process.env.LEDGER_ROOT;
  process.env.LEDGER_ROOT = path.join(dir, 'projects');
  try {
    return await syncLedger(options);
  } finally {
    if (previous === undefined) delete process.env.LEDGER_ROOT;
    else process.env.LEDGER_ROOT = previous;
  }
}

test('a ledger with no remote says so instead of pretending to sync', async () => {
  const dir = path.join(root, 'lonely');
  await mkdir(path.join(dir, 'projects'), { recursive: true });
  await git(['init', '-q', '-b', 'main', dir]);

  const result = await syncAs(dir);
  assert.equal(result.status, 'no-remote');
  assert.match(result.message, /only exists on this machine/);
  assert.match(result.message, /PRIVATE repository/);
});

test('a missing ledger folder is reported as that, not as a missing repo', async () => {
  // A freshly cloned laptop hits this first; the wrong message sends you
  // chasing the wrong problem.
  const dir = path.join(root, 'fresh');
  await git(['init', '-q', '-b', 'main', dir]);

  const previous = process.env.LEDGER_ROOT;
  process.env.LEDGER_ROOT = path.join(dir, 'projects');
  const result = await syncLedger();
  process.env.LEDGER_ROOT = previous;

  assert.equal(result.status, 'no-ledger-dir');
  assert.match(result.message, /does not exist yet/);
  assert.match(result.message, /is a repository/);
});

test('work travels from the Mac mini to the laptop and back', async () => {
  const { mini, laptop } = await makeWorkspace('round');

  // The bot records a diary entry on the mini.
  await mkdir(path.join(mini, 'projects', 'MARINA-01', '02-ledger'), { recursive: true });
  await writeFile(path.join(mini, 'projects', 'MARINA-01', '02-ledger', 'diary.md'), '## blockwork');

  const pushed = await syncAs(mini);
  assert.equal(pushed.status, 'ok');
  assert.equal(pushed.committed, true);
  assert.ok(pushed.pushed > 0, 'the first push must actually leave the machine');

  // The laptop picks it up.
  const pulled = await syncAs(laptop);
  assert.ok(pulled.pulled > 0);
  const { readFile } = await import('node:fs/promises');
  assert.match(
    await readFile(path.join(laptop, 'projects', 'MARINA-01', '02-ledger', 'diary.md'), 'utf8'),
    /blockwork/,
  );

  // The laptop edits a register and sends it back.
  await mkdir(path.join(laptop, 'projects', 'MARINA-01', '03-registers'), { recursive: true });
  await writeFile(
    path.join(laptop, 'projects', 'MARINA-01', '03-registers', 'rfi.yaml'),
    'entries: []',
  );
  const sent = await syncAs(laptop);
  assert.ok(sent.pushed > 0, 'a local commit must be pushed even with no upstream configured');

  const back = await syncAs(mini);
  assert.ok(back.pulled > 0);
  await readFile(path.join(mini, 'projects', 'MARINA-01', '03-registers', 'rfi.yaml'));
});

test('a second sync with nothing to do says so and does nothing', async () => {
  const { mini } = await makeWorkspace('quiet');
  await writeFile(path.join(mini, 'projects', 'seed.md'), 'x');
  await syncAs(mini);

  const again = await syncAs(mini);
  assert.equal(again.status, 'ok');
  assert.equal(again.committed, false);
  assert.equal(again.pulled, 0);
  assert.equal(again.pushed, 0);
  assert.match(again.message, /Already in step/);
});

test('a conflict is rolled back rather than left half-applied', async () => {
  const { mini, laptop } = await makeWorkspace('clash');

  await writeFile(path.join(mini, 'projects', 'shared.md'), 'from the mini');
  await syncAs(mini);
  await syncAs(laptop);

  // Both edit the same line before either syncs.
  await writeFile(path.join(mini, 'projects', 'shared.md'), 'mini version');
  await syncAs(mini);

  await writeFile(path.join(laptop, 'projects', 'shared.md'), 'laptop version');
  const result = await syncAs(laptop);

  assert.equal(result.status, 'conflict');
  assert.match(result.message, /rolled back/);
  assert.match(result.message, /rebase --continue/);

  // Crucially, not stranded mid-rebase: a half-finished rebase is a bad place to
  // leave someone who does not use git daily.
  const status = await git(['status', '--porcelain=v2', '--branch'], laptop);
  assert.doesNotMatch(status, /rebase/i);
});

test('--no-push pulls without publishing local work', async () => {
  const { mini, laptop } = await makeWorkspace('readonly');
  await writeFile(path.join(mini, 'projects', 'a.md'), 'one');
  await syncAs(mini);

  await writeFile(path.join(laptop, 'projects', 'b.md'), 'two');
  const result = await syncAs(laptop, { push: false });

  assert.equal(result.pushed, 0);
  assert.ok(result.committed, 'local work is still committed locally');
});
