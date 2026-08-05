import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { parseEnv, loadEnv } from '../src/util/env.js';

const root = await mkdtemp(path.join(tmpdir(), 'pm-env-test-'));
test.after(() => rm(root, { recursive: true, force: true }));

test('reads plain assignments', () => {
  assert.deepEqual(parseEnv('A=1\nB=two'), { A: '1', B: 'two' });
});

test('ignores comments and blank lines', () => {
  assert.deepEqual(parseEnv('# comment\n\n  \nA=1\n'), { A: '1' });
});

test('tolerates the "export" prefix people paste in', () => {
  assert.deepEqual(parseEnv('export TELEGRAM_BOT_TOKEN=abc'), { TELEGRAM_BOT_TOKEN: 'abc' });
});

test('strips surrounding quotes', () => {
  assert.deepEqual(parseEnv('A="one"\nB=\'two\''), { A: 'one', B: 'two' });
});

test('keeps characters that appear in real tokens', () => {
  // Telegram tokens contain a colon; URLs contain slashes and equals signs.
  const parsed = parseEnv('TELEGRAM_BOT_TOKEN=12345:AAH-abc_DEF\nURL=https://x.com/a?b=c');
  assert.equal(parsed.TELEGRAM_BOT_TOKEN, '12345:AAH-abc_DEF');
  assert.equal(parsed.URL, 'https://x.com/a?b=c');
});

test('skips malformed lines instead of throwing', () => {
  assert.deepEqual(parseEnv('no equals here\nBAD KEY=x\n=novalue\nGOOD=y'), { GOOD: 'y' });
});

test('a missing file is not an error', () => {
  assert.deepEqual(loadEnv(path.join(root, 'nope.env')), []);
});

test('the real environment always wins over the file', async () => {
  // Under launchd the plist is the source of truth; a stale .env in the checkout
  // must never quietly override it.
  const file = path.join(root, 'a.env');
  await writeFile(file, 'PM_TEST_ALREADY_SET=from-file\nPM_TEST_FRESH=from-file');

  process.env.PM_TEST_ALREADY_SET = 'from-shell';
  delete process.env.PM_TEST_FRESH;

  const applied = loadEnv(file);

  assert.equal(process.env.PM_TEST_ALREADY_SET, 'from-shell');
  assert.equal(process.env.PM_TEST_FRESH, 'from-file');
  assert.deepEqual(applied, ['PM_TEST_FRESH']);

  delete process.env.PM_TEST_ALREADY_SET;
  delete process.env.PM_TEST_FRESH;
});

test('an empty environment variable counts as unset', async () => {
  // `TELEGRAM_BOT_TOKEN=` exported by an unfinished shell profile should not
  // block the real value in .env.
  const file = path.join(root, 'b.env');
  await writeFile(file, 'PM_TEST_EMPTY=real-value');

  process.env.PM_TEST_EMPTY = '';
  loadEnv(file);

  assert.equal(process.env.PM_TEST_EMPTY, 'real-value');
  delete process.env.PM_TEST_EMPTY;
});
