import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = await mkdtemp(path.join(tmpdir(), 'pm-agent-capture-'));
process.env.LEDGER_ROOT = path.join(root, 'projects');

const { parseCapture, captureEntry, CAPTURE_KINDS } = await import('../src/bot/capture.js');
const { scaffoldProject } = await import('../src/ledger/scaffold.js');
const { readYaml } = await import('../src/ledger/store.js');
const { projectPaths } = await import('../src/ledger/paths.js');
const { COMMAND_MENU, CAPTURE_BUTTONS } = await import('../src/bot/server.js');

await scaffoldProject('CAP', { name: 'Capture test' });

test.after(() => rm(root, { recursive: true, force: true }));

const author = { name: 'Eng. Nadim Saleh', id: 7 };

test('a subject with pipe-separated fields parses into a record', () => {
  const parsed = parseCapture('Snow closes the road | owner: PMCC | impact: 2 weeks');
  assert.equal(parsed.subject, 'Snow closes the road');
  assert.equal(parsed.fields.owner, 'PMCC');
  assert.equal(parsed.fields.impact, '2 weeks');
  assert.deepEqual(parsed.unparsed, []);
});

test('a bare subject is valid - one thumb at a site gate is the design target', () => {
  const parsed = parseCapture('Scaffold licence may lapse');
  assert.equal(parsed.subject, 'Scaffold licence may lapse');
  assert.deepEqual(parsed.fields, {});
});

test('a segment that is not key:value is kept, never discarded', () => {
  // The author's words survive even when this parser does not understand them.
  const parsed = parseCapture('Subject | some stray note');
  assert.deepEqual(parsed.unparsed, ['some stray note']);
});

test('a colon inside the value survives', () => {
  const parsed = parseCapture('Access | impact: blocked 09:00 to 17:00');
  assert.equal(parsed.fields.impact, 'blocked 09:00 to 17:00');
});

test('a risk is appended with a sequential reference and the author named', async () => {
  const result = await captureEntry('CAP', 'risk', 'Snow closes the road | owner: PMCC', { author });
  assert.equal(result.ref, 'RISK-001');
  assert.equal(result.entry.status, 'open');
  assert.equal(result.entry.raisedBy, 'Eng. Nadim Saleh');

  const register = await readYaml(projectPaths('CAP').risk);
  assert.equal(register.entries.length, 1);
  assert.equal(register.nextRef, 2);
});

test('references keep incrementing rather than being reused', async () => {
  const second = await captureEntry('CAP', 'risk', 'Scaffold licence may lapse', { author });
  assert.equal(second.ref, 'RISK-002');
});

test('an omitted field is reported as missing, never filled in', async () => {
  // The invariant that keeps this safe to use one-handed: an invented owner or
  // deadline would flow straight into an alert and a chase letter.
  const result = await captureEntry('CAP', 'risk', 'Unpriced ground conditions', { author });
  assert.deepEqual(result.missing, ['owner', 'impact', 'mitigation']);
  assert.equal(result.entry.owner, undefined);
  assert.equal(result.entry.dueDate, undefined);
});

test('a decision goes to the decisions register, not the risk one', async () => {
  const result = await captureEntry('CAP', 'decision', 'Approve tile sample | owner: Client | due: 2026-08-20', {
    author,
  });
  assert.equal(result.ref, 'DEC-001');
  assert.equal(result.entry.dueDate, '2026-08-20');
  assert.equal(result.file, projectPaths('CAP').decisions);

  const risks = await readYaml(projectPaths('CAP').risk);
  assert.ok(!risks.entries.some((e) => e.subject === 'Approve tile sample'));
});

test('"by" is accepted as a due date, because that is how people write it', async () => {
  const result = await captureEntry('CAP', 'action', 'Issue setting-out drawing | by: 2026-08-12', { author });
  assert.equal(result.entry.dueDate, '2026-08-12');
  // Normalised onto one field - the registers are read by dueOn(), which would
  // otherwise see two spellings of the same thing.
  assert.equal(result.entry.by, undefined);
});

test('an empty subject records nothing at all', async () => {
  assert.equal(await captureEntry('CAP', 'risk', '   ', { author }), null);
});

test('an unknown register is refused rather than guessed at', async () => {
  assert.equal(await captureEntry('CAP', 'variation', 'Something', { author }), null);
});

test('every capture kind advertises an example that its own parser accepts', () => {
  for (const [kind, spec] of Object.entries(CAPTURE_KINDS)) {
    const body = spec.example.replace(`/${kind} `, '');
    assert.ok(parseCapture(body).subject.length > 0, `${kind} example must parse`);
  }
});

test('every menu command is a valid Telegram command with a description', () => {
  for (const entry of COMMAND_MENU) {
    assert.match(entry.command, /^[a-z0-9_]{1,32}$/, `${entry.command} is not a legal command`);
    assert.ok(entry.description.length > 0 && entry.description.length <= 256);
  }
});

test('every register that can be captured is reachable from the menu', () => {
  // The menu deliberately carries one way in - /log - rather than one command
  // per register: nobody standing on a site remembers which register a thought
  // belongs in. The buttons /log offers are what must stay exhaustive.
  const commands = new Set(COMMAND_MENU.map((c) => c.command));
  assert.ok(commands.has('log'), '/log is missing from the Telegram menu');

  const reachable = new Set(CAPTURE_BUTTONS.flat().map((b) => b.send.replace('/logas ', '')));
  for (const kind of Object.keys(CAPTURE_KINDS)) {
    assert.ok(reachable.has(kind), `${kind} cannot be reached from the /log buttons`);
  }
});
