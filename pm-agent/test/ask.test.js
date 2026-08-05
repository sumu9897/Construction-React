import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runClaude, LEDGER_SYSTEM_PROMPT } from '../src/bot/ask.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FAKE = path.join(here, 'fixtures', 'fake-claude.js');

const root = await mkdtemp(path.join(tmpdir(), 'pm-ask-test-'));
await chmod(FAKE, 0o755);

test.after(() => rm(root, { recursive: true, force: true }));

/** Run against the stub rather than the real CLI, so tests cost nothing. */
const run = (options = {}, env = {}) => {
  const previous = { ...process.env };
  Object.assign(process.env, env);
  return runClaude({ cwd: root, prompt: 'test question', command: FAKE, ...options }).finally(() => {
    process.env = previous;
  });
};

test('returns the model reply and the cost', async () => {
  const result = await run({}, { FAKE_CLAUDE_RESULT: 'The slab was poured on 3 August (02-ledger/diary.md).' });

  assert.equal(result.ok, true);
  assert.match(result.result, /02-ledger\/diary.md/);
  assert.equal(result.costUsd, 0.0123);
  assert.equal(result.error, null);
});

test('the invocation is read-only, enforced twice', async () => {
  const argsFile = path.join(root, 'args.json');
  await run({}, { FAKE_CLAUDE_ARGS_OUT: argsFile, FAKE_CLAUDE_RESULT: 'ok' });
  const args = JSON.parse(await readFile(argsFile, 'utf8'));

  const allowedAt = args.indexOf('--allowedTools');
  const deniedAt = args.indexOf('--disallowedTools');
  assert.ok(allowedAt > -1 && deniedAt > -1);
  assert.equal(args[allowedAt + 1], 'Read,Grep,Glob');
  assert.match(args[deniedAt + 1], /Write/);
  assert.match(args[deniedAt + 1], /Bash/);

  // The flags that would throw the safety property away.
  assert.ok(!args.includes('--dangerously-skip-permissions'));
  assert.ok(!args.some((a) => String(a).includes('bypassPermissions')));

  // A cost ceiling is always passed.
  assert.ok(args.includes('--max-budget-usd'));
});

test('the citation rules are sent as a system prompt', async () => {
  const argsFile = path.join(root, 'args2.json');
  await run(
    { systemPrompt: LEDGER_SYSTEM_PROMPT },
    { FAKE_CLAUDE_ARGS_OUT: argsFile, FAKE_CLAUDE_RESULT: 'ok' },
  );
  const args = JSON.parse(await readFile(argsFile, 'utf8'));

  const at = args.indexOf('--append-system-prompt');
  assert.ok(at > -1);
  assert.match(args[at + 1], /Not in the project record/);
  assert.match(args[at + 1], /Never estimate/);
  assert.match(args[at + 1], /02-ledger\/events\.yaml/);
});

test('a denied tool call is surfaced rather than swallowed', async () => {
  const result = await run({}, { FAKE_CLAUDE_RESULT: 'done', FAKE_CLAUDE_DENIALS: '2' });
  assert.equal(result.denials.length, 2);
  assert.equal(result.ok, true, 'the answer still stands; the denial is a warning');
});

test('an error from the model is reported, not returned as an answer', async () => {
  const result = await run({}, { FAKE_CLAUDE_ERROR: 'budget exceeded' });
  assert.equal(result.ok, false);
  assert.match(result.error, /budget exceeded/);
});

test('a non-zero exit is not treated as success', async () => {
  const result = await run({}, { FAKE_CLAUDE_RESULT: 'partial', FAKE_CLAUDE_EXIT: '1' });
  assert.equal(result.ok, false);
});

test('unparseable output fails cleanly instead of throwing', async () => {
  const result = await run({}, { FAKE_CLAUDE_GARBAGE: '1' });
  assert.equal(result.ok, false);
  assert.match(result.error, /Could not parse/);
});

test('a missing claude CLI gives an actionable message, not a stack trace', async () => {
  const result = await runClaude({
    cwd: root,
    prompt: 'x',
    command: path.join(root, 'definitely-not-installed'),
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /was not found/);
  assert.match(result.error, /PM_CLAUDE_BIN/);
});

test('a hung process is killed rather than hanging the bot', async () => {
  const result = await run({ timeoutMs: 300 }, { FAKE_CLAUDE_HANG: '1' });
  assert.equal(result.ok, false);
  assert.match(result.error, /Timed out/);
});

test('a JSON schema request parses the reply into an object', async () => {
  const result = await run(
    { jsonSchema: { type: 'object', properties: { weather: { type: 'string' } } } },
    { FAKE_CLAUDE_RESULT: '{"weather":"hot, 44C"}' },
  );
  assert.deepEqual(result.parsed, { weather: 'hot, 44C' });
});

test('a schema reply that is not valid JSON leaves parsed null rather than throwing', async () => {
  const result = await run(
    { jsonSchema: { type: 'object' } },
    { FAKE_CLAUDE_RESULT: 'sorry, I could not do that' },
  );
  assert.equal(result.parsed, null);
  assert.equal(result.result, 'sorry, I could not do that');
});
