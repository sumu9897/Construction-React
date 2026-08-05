import test from 'node:test';
import assert from 'node:assert/strict';

import { parseReply } from '../src/bot/parseReply.js';
import { buildP6UpdateCsv } from '../src/export/p6update.js';

// 2026-07-30 is a Thursday. Weekday resolution is tested against that.
const asOf = '2026-07-30';
const ctx = (kind) => ({ asOf, exception: { kind } });

test('reads the way a site answer is actually phrased', () => {
  const result = parseReply('started tuesday, we are about 30% done', ctx('overdue-start'));
  assert.equal(result.status, 'in-progress');
  assert.equal(result.percentComplete, 30);
  assert.equal(result.actualStart, '2026-07-28');
});

test('a bare yes answers the question that was asked', () => {
  assert.equal(parseReply('yes', ctx('overdue-start')).status, 'in-progress');
  assert.equal(parseReply('yes', ctx('overdue-finish')).status, 'complete');
});

test('a bare no is read against the question too', () => {
  assert.equal(parseReply('no', ctx('overdue-start')).status, 'not-started');
});

test('recognises completion and dates it', () => {
  const result = parseReply('finished yesterday', ctx('overdue-finish'));
  assert.equal(result.status, 'complete');
  assert.equal(result.percentComplete, 100);
  assert.equal(result.actualFinish, '2026-07-29');
});

test('does not read "not started" as started', () => {
  const result = parseReply('not started yet, still waiting on the slab', ctx('overdue-start'));
  assert.equal(result.status, 'not-started');
});

test('resolves relative dates', () => {
  assert.equal(parseReply('started 3 days ago', ctx('overdue-start')).actualStart, '2026-07-27');
  assert.equal(parseReply('started today', ctx('overdue-start')).actualStart, asOf);
});

test('resolves an explicit calendar date', () => {
  assert.equal(parseReply('started 12 aug', ctx('overdue-start')).actualStart, '2026-08-12');
  assert.equal(parseReply('started 2026-07-15', ctx('overdue-start')).actualStart, '2026-07-15');
});

test('reads a forecast finish as a forecast, not an actual', () => {
  const result = parseReply('still running, will finish next friday', ctx('overdue-finish'));
  assert.equal(result.actualFinish, null);
  assert.equal(result.forecastFinish, '2026-08-07');
});

test('picks up a delay and refuses to decide whose fault it is', () => {
  const result = parseReply('started tuesday but the block delivery came up short', ctx('overdue-start'));
  assert.ok(result.delay);
  assert.equal(result.delay.responsibilityHint, 'contractor-or-supplier');
  assert.equal(result.delay.responsibility, null, 'entitlement is never inferred from a keyword');
});

test('picks up an employer-side delay cue', () => {
  const result = parseReply('cannot start, still waiting for approval of the shop drawings', ctx('overdue-start'));
  assert.equal(result.delay.responsibilityHint, 'employer-or-consultant');
});

test('picks up the delay when the thing being waited on is several words away', () => {
  // How it is actually said, rather than how a form would phrase it.
  const result = parseReply(
    'started 6 july, about 40% done, we lost time waiting for the consultant to approve the shop drawings',
    ctx('overdue-start'),
  );
  assert.equal(result.delay.responsibilityHint, 'employer-or-consultant');
  assert.equal(result.percentComplete, 40);
  assert.equal(result.actualStart, '2026-07-06');
});

test('treats lost time as a delay even when the cause is not stated', () => {
  const result = parseReply('we lost two days this week', ctx('slipping'));
  assert.equal(result.delay.responsibilityHint, 'unclear');
  assert.equal(result.delay.needsClassification, true);
});

test('picks up weather as neutral and asks for classification', () => {
  const result = parseReply('lost two days to rain', ctx('slipping'));
  assert.equal(result.delay.responsibilityHint, 'neutral');
  assert.equal(result.delay.needsClassification, true);
});

test('reports what it could not extract instead of guessing', () => {
  const result = parseReply('yeah its going', ctx('overdue-start'));
  assert.equal(result.status, 'in-progress');
  assert.deepEqual(result.ambiguous, ['start date not stated', 'percent complete not stated']);
});

test('an empty reply is ambiguous, not an answer', () => {
  const result = parseReply('   ', ctx('overdue-start'));
  assert.equal(result.status, null);
  assert.deepEqual(result.ambiguous, ['empty reply']);
});

test('rejects an out-of-range percentage rather than storing it', () => {
  const result = parseReply('about 300% done', ctx('slipping'));
  assert.equal(result.percentComplete, null);
  assert.ok(result.ambiguous.some((a) => a.includes('out of range')));
  // "done" must not promote this to complete on the back of a bad number.
  assert.notEqual(result.status, 'complete');
});

test('a stated percentage beats a completion keyword', () => {
  // "30% done" is the single most common way this gets said on site.
  const result = parseReply('30% done', ctx('slipping'));
  assert.equal(result.status, 'in-progress');
  assert.equal(result.percentComplete, 30);
});

test('reads remaining duration when it is stated', () => {
  assert.equal(parseReply('2 weeks left', ctx('slipping')).remainingDays, 14);
});

test('confidence reflects how much was actually extracted', () => {
  assert.equal(parseReply('started tuesday, 30%', ctx('overdue-start')).confidence, 'high');
  assert.equal(parseReply('yeah its going', ctx('overdue-start')).confidence, 'medium');
  assert.equal(parseReply('hmm', ctx('overdue-start')).confidence, 'low');
});

// --- P6 export -------------------------------------------------------------

test('P6 update uses the column headers the import wizard expects', () => {
  const csv = buildP6UpdateCsv([
    { code: 'A-1240', name: 'Level 3 blockwork', actualStart: '2026-07-28', percentComplete: 30, remainingDays: 12 },
  ]);
  const [header, row] = csv.trim().split('\n');
  assert.equal(header, 'Activity ID,Activity Name,Actual Start,Actual Finish,Physical % Complete,Remaining Duration');
  // P6 wants DD-MMM-YY dates and remaining duration in hours.
  assert.equal(row, 'A-1240,Level 3 blockwork,28-Jul-26,,30,96');
});

test('P6 update leaves unknown fields empty rather than zero', () => {
  const csv = buildP6UpdateCsv([{ code: 'A-1', name: 'X' }]);
  assert.equal(csv.trim().split('\n')[1], 'A-1,X,,,,');
});

test('P6 update escapes activity names containing commas', () => {
  const csv = buildP6UpdateCsv([{ code: 'A-1', name: 'Slab, level 3' }]);
  assert.match(csv, /"Slab, level 3"/);
});
