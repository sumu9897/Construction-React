import test from 'node:test';
import assert from 'node:assert/strict';

import { parsePhrase, parseDatePhrase } from '../src/bot/phrase.js';
import { parseCapture } from '../src/bot/capture.js';

const ASOF = '2026-07-30'; // a Thursday

// --- dates -----------------------------------------------------------------

test('reads the date formats a site manager types', () => {
  assert.equal(parseDatePhrase('1 aug', ASOF), '2026-08-01');
  assert.equal(parseDatePhrase('1 august', ASOF), '2026-08-01');
  assert.equal(parseDatePhrase('aug 1', ASOF), '2026-08-01');
  assert.equal(parseDatePhrase('1st august 2026', ASOF), '2026-08-01');
  assert.equal(parseDatePhrase('2026-08-01', ASOF), '2026-08-01');
  assert.equal(parseDatePhrase('1/8', ASOF), '2026-08-01');
  assert.equal(parseDatePhrase('01/08/2026', ASOF), '2026-08-01');
});

test('resolves relative phrases against the day it is told', () => {
  assert.equal(parseDatePhrase('today', ASOF), '2026-07-30');
  assert.equal(parseDatePhrase('tomorrow', ASOF), '2026-07-31');
  assert.equal(parseDatePhrase('in 3 days', ASOF), '2026-08-02');
  assert.equal(parseDatePhrase('in 2 weeks', ASOF), '2026-08-13');
  assert.equal(parseDatePhrase('friday', ASOF), '2026-07-31');
  assert.equal(parseDatePhrase('end of week', ASOF), '2026-07-31');
  assert.equal(parseDatePhrase('end of month', ASOF), '2026-07-31');
});

test('a bare day and month that has passed means next year, not last', () => {
  // Said on 30 Jul, "1 jul" cannot mean four weeks ago - it is next July.
  assert.equal(parseDatePhrase('1 jul', ASOF), '2027-07-01');
  assert.equal(parseDatePhrase('1 aug', ASOF), '2026-08-01');
});

test('an unreadable date is null rather than a plausible one', () => {
  assert.equal(parseDatePhrase('soon', ASOF), null);
  assert.equal(parseDatePhrase('when the steel lands', ASOF), null);
  assert.equal(parseDatePhrase('31 feb', ASOF), null);
  assert.equal(parseDatePhrase('', ASOF), null);
});

// --- phrases ---------------------------------------------------------------

test('reads owner and due out of the sentence that was actually typed', () => {
  // The line from the phone that started this.
  const { subject, fields } = parsePhrase('order concrete batch owner Jihad PMCC due by 1 aug', {
    asOf: ASOF,
  });
  assert.equal(subject, 'order concrete batch');
  assert.equal(fields.owner, 'Jihad PMCC');
  assert.equal(fields.due, '2026-08-01');
});

test('reads the other orderings and connectives', () => {
  const a = parsePhrase('chase the shop drawings with Consultant by friday', { asOf: ASOF });
  assert.equal(a.subject, 'chase the shop drawings');
  assert.equal(a.fields.owner, 'Consultant');
  assert.equal(a.fields.due, '2026-07-31');

  const b = parsePhrase('approve tile sample due 20 aug assigned to Client', { asOf: ASOF });
  assert.equal(b.subject, 'approve tile sample');
  assert.equal(b.fields.owner, 'Client');
  assert.equal(b.fields.due, '2026-08-20');
});

test('reads risk fields', () => {
  const { subject, fields } = parsePhrase(
    'snow closes the road in December owner PMCC impact two weeks lost on externals',
    { asOf: ASOF },
  );
  assert.equal(subject, 'snow closes the road in December');
  assert.equal(fields.owner, 'PMCC');
  assert.equal(fields.impact, 'two weeks lost on externals');
});

test('"by" is a deadline only when a date follows it', () => {
  // "by crane" is how the work is done, not who owns it or when it is due.
  const { subject, fields } = parsePhrase('lift the steel beams by crane', { asOf: ASOF });
  assert.equal(subject, 'lift the steel beams by crane');
  assert.equal(fields.due, undefined);
  assert.equal(fields.owner, undefined);
});

test('a keyword that is part of the work is left in the subject', () => {
  const { subject, fields } = parsePhrase('agree impact of the permit stoppage with Client', {
    asOf: ASOF,
  });
  assert.equal(fields.owner, 'Client');
  // "impact of the permit stoppage" is the subject, not an impact field, because
  // the owner keyword closes the segment after it.
  assert.match(subject, /permit stoppage/);
});

test('a sentence with no fields is left entirely alone', () => {
  const { subject, fields } = parsePhrase('pour the raft slab on house A', { asOf: ASOF });
  assert.equal(subject, 'pour the raft slab on house A');
  assert.deepEqual(fields, {});
});

test('a line that is nothing but a keyword keeps the words rather than emptying', () => {
  const { subject } = parsePhrase('owner Client', { asOf: ASOF });
  assert.equal(subject, 'owner Client');
});

test('an unreadable due is reported, not silently dropped', () => {
  const { fields } = parsePhrase('order the tiles due when the client decides', { asOf: ASOF });
  assert.equal(fields.due, undefined);
  assert.equal(fields.dueUnreadable, 'when the client decides');
});

// --- interaction with the pipe syntax --------------------------------------

test('the pipe syntax still works and still wins', () => {
  const { subject, fields } = parseCapture(
    'order concrete batch owner Jihad | owner: Consultant | due: 2026-09-01',
    { asOf: ASOF },
  );
  assert.equal(subject, 'order concrete batch');
  // Spelled out explicitly, so the phrase reading does not get to override it.
  assert.equal(fields.owner, 'Consultant');
  assert.equal(fields.due, '2026-09-01');
});

test('plain English and pipes combine without either being lost', () => {
  const { subject, fields } = parseCapture('order concrete batch due 1 aug | owner: Jihad', {
    asOf: ASOF,
  });
  assert.equal(subject, 'order concrete batch');
  assert.equal(fields.owner, 'Jihad');
  assert.equal(fields.due, '2026-08-01');
});
