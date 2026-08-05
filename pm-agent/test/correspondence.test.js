import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = await mkdtemp(path.join(tmpdir(), 'pm-corr-test-'));
process.env.LEDGER_ROOT = path.join(root, 'projects');

const { buildChaseDraft, findEntry, openItems, writeChaseDraft } = await import(
  '../src/correspondence/chase-draft.js'
);
const { scaffoldProject } = await import('../src/ledger/scaffold.js');
const { projectPaths } = await import('../src/ledger/paths.js');
const { writeYaml } = await import('../src/ledger/store.js');

const CODE = 'CORR-01';
const brand = { company: { name: 'PMCC' }, issuer: { name: 'N. Saleh', title: 'Project Manager' } };
const asOf = '2026-08-05';

test.after(() => rm(root, { recursive: true, force: true }));

const draft = (entry, overrides = {}) =>
  buildChaseDraft({
    entry,
    source: { key: 'decisions', label: 'decision', noun: 'decision' },
    projectCode: CODE,
    projectName: 'Test Tower',
    brand,
    asOf,
    ...overrides,
  });

test('a complete record produces a letter that states the consequence', () => {
  const { body, missing } = draft({
    ref: 'DEC-001',
    subject: 'Facade sample approval',
    owner: 'Employer',
    dueDate: '2026-08-01',
    consequence: 'Facade procurement cannot be released',
    activity: 'A-1400',
  });

  assert.deepEqual(missing, []);
  assert.match(body, /To:\*\* Employer/);
  assert.match(body, /4 days overdue/);
  assert.match(body, /The effect of further delay is as follows: Facade procurement cannot be released/);
  assert.match(body, /affects programme activity A-1400/);
  assert.match(body, /N\. Saleh/);
  assert.match(body, /Draft only\. Review, then send it yourself\./);
});

test('an unrecorded consequence is omitted, never invented', () => {
  // This is the paragraph that makes a chaser work. A plausible invented one
  // would be worse than none.
  const { body, missing } = draft({
    ref: 'DEC-002',
    subject: 'Riser layout instruction',
    owner: 'Engineer',
    dueDate: '2026-08-01',
  });

  assert.doesNotMatch(body, /The effect of further delay/);
  assert.ok(missing.some((m) => /No consequence recorded/.test(m)));
  assert.match(body, /## Not in the record/);
  assert.match(body, /Add it to the register and regenerate/);
});

test('an RFI cites the contractual response period', () => {
  const { body } = draft(
    { ref: 'RFI-014', subject: 'Riser coordination', owner: 'Engineer', date: '2026-07-08' },
    { source: { key: 'rfi', label: 'RFI', noun: 'request for information' }, responseDays: 14 },
  );

  assert.match(body, /outstanding for 28 days against a 14-day period under the Contract/);
  assert.match(body, /remains unanswered/);
});

test('with no response period recorded, no period is asserted', () => {
  const { body } = draft(
    { ref: 'RFI-015', subject: 'Tie spacing', owner: 'Engineer', date: '2026-07-08' },
    { source: { key: 'rfi', label: 'RFI', noun: 'request for information' }, responseDays: null },
  );

  assert.match(body, /outstanding for 28 days, and remains unanswered/);
  assert.doesNotMatch(body, /under the Contract/);
});

test('a missing owner produces a placeholder and is flagged, not guessed', () => {
  const { body, missing } = draft({ ref: 'DEC-003', subject: 'Something', dueDate: '2026-08-01' });
  assert.match(body, /\[recipient\]/);
  assert.ok(missing.some((m) => /No owner recorded/.test(m)));
});

test('a future due date becomes the reply-by date', () => {
  const { body } = draft({ ref: 'DEC-004', subject: 'X', owner: 'Employer', dueDate: '2026-08-20' });
  assert.match(body, /falls due on 20 Aug 2026/);
  assert.match(body, /response by 20 Aug 2026/);
});

test('an already-overdue item gets a fresh seven-day reply-by date', () => {
  const { body } = draft({ ref: 'DEC-005', subject: 'X', owner: 'Employer', dueDate: '2026-07-01' });
  assert.match(body, /35 days overdue/);
  assert.match(body, /response by 12 Aug 2026/);
});

test('an entry with no dates at all still produces a usable letter', () => {
  const { body, missing } = draft({ ref: 'DEC-006', subject: 'Undated thing', owner: 'Employer' });
  assert.match(body, /which remains outstanding/);
  assert.ok(missing.some((m) => /No due date or raised date/.test(m)));
});

// --- lookup and listing ----------------------------------------------------

test('references are found across every register', async () => {
  const paths = await scaffoldProject(CODE, { name: 'Test Tower' });

  await writeYaml(paths.decisions, {
    nextRef: 2,
    entries: [{ ref: 'DEC-001', subject: 'Facade sample', owner: 'Employer', dueDate: '2026-08-01', status: 'open' }],
  });
  await writeYaml(paths.actions, {
    nextRef: 2,
    entries: [{ ref: 'ACT-001', subject: 'Setting-out drawing', owner: 'Design', dueDate: '2026-08-20', status: 'open' }],
  });
  await writeYaml(paths.rfi, {
    nextRef: 2,
    entries: [
      { ref: 'RFI-014', subject: 'Riser coordination', owner: 'Engineer', date: '2026-07-08', status: 'open' },
      { ref: 'RFI-013', subject: 'Closed one', owner: 'Engineer', date: '2026-06-01', status: 'closed' },
    ],
  });

  assert.equal((await findEntry(CODE, 'DEC-001')).source.key, 'decisions');
  assert.equal((await findEntry(CODE, 'ACT-001')).source.key, 'actions');
  assert.equal((await findEntry(CODE, 'RFI-014')).source.key, 'rfi');
  assert.equal(await findEntry(CODE, 'NOPE-999'), null);
});

test('reference lookup is case-insensitive, because nobody types carefully on a phone', async () => {
  assert.ok(await findEntry(CODE, 'dec-001'));
  assert.ok(await findEntry(CODE, '  DEC-001  '));
});

test('open items exclude closed ones and sort by urgency', async () => {
  const items = await openItems(CODE, { asOf });

  assert.ok(!items.some((i) => i.ref === 'RFI-013'), 'closed items are not chased');
  assert.equal(items[0].ref, 'DEC-001', 'the most urgent comes first');

  const remaining = items.map((i) => i.daysRemaining ?? 9999);
  assert.deepEqual(remaining, [...remaining].sort((a, b) => a - b));
});

test('writing a draft puts it in 06-outputs and returns what it left out', async () => {
  const result = await writeChaseDraft(CODE, 'RFI-014', { brand, asOf });

  assert.match(result.file, /06-outputs\/correspondence\/2026-08-05-chase-RFI-014\.md$/);
  assert.equal(result.source.key, 'rfi');
  assert.ok(result.missing.some((m) => /consequence/.test(m)));

  const { readFile } = await import('node:fs/promises');
  const written = await readFile(result.file, 'utf8');
  assert.equal(written, result.body);
});

test('an unknown reference returns null rather than writing an empty letter', async () => {
  assert.equal(await writeChaseDraft(CODE, 'ZZZ-001', { brand }), null);
});
