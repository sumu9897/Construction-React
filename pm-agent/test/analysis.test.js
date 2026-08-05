import test from 'node:test';
import assert from 'node:assert/strict';

import { parseXerText } from '../src/parse/xer.js';
import { normalizeProgramme } from '../src/parse/normalize.js';
import { computeExceptions, KINDS } from '../src/analysis/exceptions.js';
import { diffProgrammes } from '../src/analysis/diff.js';
import { checkProgrammeHealth } from '../src/analysis/health.js';
import { makeXer, BASE_PROGRAMME, REVISED_PROGRAMME } from './fixtures/make-xer.js';

const load = (spec) => normalizeProgramme(parseXerText(makeXer(spec)));

const base = load(BASE_PROGRAMME);
const revised = load(REVISED_PROGRAMME);

const config = { lookaheadDays: 14, nearCriticalFloatDays: 10, maxQuestionsPerSession: 6 };
const find = (result, code) => result.all.find((e) => e.code === code);

test('flags an activity that should have started and has not', () => {
  const result = computeExceptions(base, { asOf: '2026-07-01', config, limit: 20 });
  const exception = find(result, 'A-1300');
  assert.ok(exception, 'A-1300 was due to start 22 Jun and has not started');
  assert.equal(exception.kind, KINDS.OVERDUE_START);
  assert.equal(exception.detail.daysLate, 9);
});

test('flags an in-progress activity whose remaining duration no longer fits', () => {
  // A-1240 has 12 days remaining on 1 Jul against a 6 Jul finish.
  const result = computeExceptions(base, { asOf: '2026-07-01', config, limit: 20 });
  const exception = find(result, 'A-1240');
  assert.equal(exception.kind, KINDS.SLIPPING);
  assert.equal(exception.detail.daysLate, 7);
});

test('flags an overdue finish once the date has passed', () => {
  const result = computeExceptions(base, { asOf: '2026-07-10', config, limit: 20 });
  assert.equal(find(result, 'A-1240').kind, KINDS.OVERDUE_FINISH);
});

test('negative float outranks everything else', () => {
  const result = computeExceptions(revised, { asOf: '2026-08-01', config, limit: 20 });
  assert.equal(find(result, 'A-1240').kind, KINDS.NEGATIVE_FLOAT);
});

test('ignores completed activities and high-float noise', () => {
  const result = computeExceptions(base, { asOf: '2026-07-01', config, limit: 20 });
  assert.equal(find(result, 'A-1000'), undefined, 'complete activities are not chased');
  assert.equal(
    find(result, 'A-1400'),
    undefined,
    'a not-yet-due activity with 60 days float is not worth a 7am question',
  );
});

test('orders questions by severity, worst first', () => {
  const result = computeExceptions(base, { asOf: '2026-07-10', config, limit: 20 });
  const severities = result.questions.map((q) => q.severity);
  assert.deepEqual(severities, [...severities].sort((a, b) => b - a));
});

test('caps the number of questions per session', () => {
  const result = computeExceptions(base, { asOf: '2026-07-10', config, limit: 2 });
  assert.equal(result.questions.length, 2);
  assert.ok(result.remaining >= 1);
});

test('does not re-ask about an activity already answered today', () => {
  const progress = {
    activities: { 'A-1300': { updatedAt: '2026-07-01T09:00:00', status: 'in-progress' } },
  };
  const result = computeExceptions(base, { asOf: '2026-07-01', config, progress, limit: 20 });
  assert.equal(find(result, 'A-1300'), undefined);
  assert.equal(result.suppressed, 1);
});

test('reports how stale the programme is', () => {
  const result = computeExceptions(base, { asOf: '2026-07-20', config, limit: 20 });
  assert.equal(result.programmeAgeDays, 19);
});

test('questions name the activity and the float in plain language', () => {
  const result = computeExceptions(base, { asOf: '2026-07-01', config, limit: 20 });
  const question = find(result, 'A-1300').question;
  assert.match(question, /A-1300/);
  assert.match(question, /9d ago/);
  assert.match(question, /critical path/);
});

// --- diff engine -----------------------------------------------------------

const diff = diffProgrammes(base, revised);

test('detects a logic link removed between revisions', () => {
  assert.equal(diff.summary.logicRemoved, 1);
  assert.match(diff.logic.removed[0].link, /A-1400->M-9000/);
});

test('detects a lag stretched between revisions', () => {
  const changed = diff.logic.changed.find((l) => l.link.includes('A-1240->A-1300'));
  assert.equal(changed.from.lagDays, 5);
  assert.equal(changed.to.lagDays, 15);
  assert.equal(changed.lagIncreasedDays, 10);
});

test('detects a duration cut with no progress behind it', () => {
  const cut = diff.durationChanges.find((d) => d.code === 'A-1240');
  assert.equal(cut.fromDays, 25);
  assert.equal(cut.toDays, 19);
  assert.equal(cut.unsupported, true, 'percent complete did not move, so the cut is unsupported');
});

test('detects an incomplete activity deleted from the programme', () => {
  const removed = diff.removed.filter((a) => !a.wasComplete);
  assert.equal(removed.length, 1);
  assert.equal(removed[0].code, 'A-1400');
});

test('detects a hard constraint added to the completion milestone', () => {
  const added = diff.constraintChanges.filter((c) => c.hardConstraintAdded);
  assert.equal(added.length, 1);
  assert.equal(added[0].code, 'M-9000');
  assert.equal(added[0].to.type, 'Mandatory Finish');
});

test('detects float going negative', () => {
  assert.ok(diff.summary.floatWentNegative >= 1);
  assert.ok(diff.floatChanges.some((f) => f.code === 'A-1240' && f.wentNegative));
});

test('surfaces all of it as red flags a reviewer reads first', () => {
  const flags = diff.redFlags.join(' ');
  assert.match(flags, /logic link was removed/);
  assert.match(flags, /lag was increased/);
  assert.match(flags, /cut with no corresponding progress/);
  assert.match(flags, /hard constraint was added/);
  assert.match(flags, /incomplete activity was deleted/);
});

test('a programme compared with itself produces no red flags', () => {
  const identical = diffProgrammes(base, load(BASE_PROGRAMME));
  assert.deepEqual(identical.redFlags, []);
  assert.equal(identical.summary.logicRemoved, 0);
  assert.equal(identical.summary.dateChanges, 0);
});

// --- health check ----------------------------------------------------------

test('DCMA check counts dangling logic', () => {
  const health = checkProgrammeHealth(base);
  const logic = health.checks.find((c) => c.name.startsWith('1.'));
  // A-1000 (no predecessor) and M-9000 (no successor) are the legitimate
  // endpoints; A-1400 dangles because nothing drives the facade procurement,
  // which is exactly the kind of open end this check exists to surface.
  assert.equal(logic.count, 3);
  assert.ok(logic.examples.some((e) => e.startsWith('A-1400')));
});

test('DCMA check fails on a hard constraint', () => {
  const health = checkProgrammeHealth(revised);
  const constraints = health.checks.find((c) => c.name.startsWith('5.'));
  assert.equal(constraints.count, 1);
  assert.equal(constraints.passed, false);
});

test('DCMA check fails on negative float', () => {
  const health = checkProgrammeHealth(revised);
  const negative = health.checks.find((c) => c.name.startsWith('7.'));
  assert.equal(negative.passed, false);
  assert.ok(negative.count >= 1);
});

test('DCMA check reports lags', () => {
  const health = checkProgrammeHealth(base);
  const lags = health.checks.find((c) => c.name.startsWith('3.'));
  assert.equal(lags.count, 1);
});

test('DCMA check marks resource loading not applicable when there is none', () => {
  const health = checkProgrammeHealth(base);
  const resources = health.checks.find((c) => c.name.startsWith('10.'));
  assert.match(resources.note, /not applicable/);
});

test('checks 12-14 are declared unassessed rather than silently passed', () => {
  const health = checkProgrammeHealth(base);
  assert.equal(health.notAssessed.length, 3);
  assert.match(health.notAssessed[0].name, /Critical path test/);
});
