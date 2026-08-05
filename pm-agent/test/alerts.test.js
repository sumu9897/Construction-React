import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateAlerts, dateTier, ageTier, CONDITIONS } from '../src/alerts/rules.js';
import { reconcile, snooze } from '../src/alerts/state.js';
import { parseXerText } from '../src/parse/xer.js';
import { normalizeProgramme } from '../src/parse/normalize.js';
import { makeXer, BASE_PROGRAMME } from './fixtures/make-xer.js';

const asOf = '2026-08-05';
const programme = normalizeProgramme(parseXerText(makeXer(BASE_PROGRAMME)));

const find = (alerts, key) => alerts.find((a) => a.key === key);

// --- tiering ---------------------------------------------------------------

test('dateTier escalates as the date approaches', () => {
  const t = [3, 7, 14];
  assert.equal(dateTier(20, t), null, 'too far out to be worth saying anything');
  assert.equal(dateTier(14, t).label, '14d');
  assert.equal(dateTier(10, t).label, '14d');
  assert.equal(dateTier(7, t).label, '7d');
  assert.equal(dateTier(5, t).label, '7d');
  assert.equal(dateTier(3, t).label, '3d');
  assert.equal(dateTier(0, t).label, '3d');
  assert.equal(dateTier(-1, t).label, 'overdue');
});

test('dateTier indices increase monotonically with urgency', () => {
  const t = [3, 7, 14];
  const indices = [14, 7, 3, -1].map((d) => dateTier(d, t).index);
  assert.deepEqual(indices, [1, 2, 3, 4]);
});

test('ageTier escalates as something gets older', () => {
  const t = [10, 21];
  assert.equal(ageTier(5, t), null);
  assert.equal(ageTier(10, t).index, 1);
  assert.equal(ageTier(20, t).index, 1);
  assert.equal(ageTier(21, t).index, 2);
  assert.equal(ageTier(60, t).index, 2);
});

// --- notice ----------------------------------------------------------------

test('a notice deadline alerts, and says what it is about', () => {
  const alerts = evaluateAlerts({
    asOf,
    events: {
      entries: [
        { ref: 'EV-001', date: '2026-07-20', activity: 'A-1240', noticeDeadline: '2026-08-10', noticeIssued: false },
      ],
    },
  });

  const alert = find(alerts, 'notice:EV-001');
  assert.equal(alert.condition, CONDITIONS.NOTICE);
  assert.equal(alert.tierLabel, '7d');
  assert.match(alert.detail, /A-1240/);
  assert.match(alert.detail, /No notice recorded as issued/);
});

test('an issued notice stops alerting', () => {
  const alerts = evaluateAlerts({
    asOf,
    events: { entries: [{ ref: 'EV-001', noticeDeadline: '2026-08-06', noticeIssued: true }] },
  });
  assert.equal(find(alerts, 'notice:EV-001'), undefined);
});

test('a passed notice deadline is critical, not silent', () => {
  const alerts = evaluateAlerts({
    asOf,
    events: { entries: [{ ref: 'EV-002', date: '2026-07-01', noticeDeadline: '2026-08-01', noticeIssued: false }] },
  });
  const alert = find(alerts, 'notice:EV-002');
  assert.equal(alert.tierLabel, 'overdue');
  assert.equal(alert.severity, 'critical');
  assert.match(alert.title, /4 days overdue/);
});

// --- decisions -------------------------------------------------------------

test('an open decision alerts with its owner and consequence', () => {
  const alerts = evaluateAlerts({
    asOf,
    decisions: {
      entries: [
        {
          ref: 'DEC-001',
          subject: 'Facade sample approval',
          owner: 'Employer',
          dueDate: '2026-08-07',
          consequence: 'Procurement cannot be released',
          status: 'open',
        },
      ],
    },
  });

  const alert = find(alerts, 'decision:DEC-001');
  assert.match(alert.detail, /With Employer/);
  assert.match(alert.detail, /If late: Procurement cannot be released/);
});

test('a closed decision does not alert', () => {
  const alerts = evaluateAlerts({
    asOf,
    decisions: { entries: [{ ref: 'DEC-002', dueDate: '2026-08-01', status: 'closed' }] },
  });
  assert.equal(find(alerts, 'decision:DEC-002'), undefined);
});

test('an entry with no status at all is treated as open', () => {
  // The unclassified item is exactly the one that needs a nudge.
  const alerts = evaluateAlerts({
    asOf,
    decisions: { entries: [{ ref: 'DEC-003', subject: 'Unlabelled', dueDate: '2026-08-06' }] },
  });
  assert.ok(find(alerts, 'decision:DEC-003'));
});

// --- SLA -------------------------------------------------------------------

test('an RFI beyond the contractual period alerts, and escalates at twice the period', () => {
  const config = { contract: { rfiResponseDays: 14 } };
  const entry = { ref: 'RFI-014', subject: 'Riser coordination', owner: 'Engineer', status: 'open' };

  const once = evaluateAlerts({ asOf, config, rfi: { entries: [{ ...entry, date: '2026-07-15' }] } });
  assert.equal(find(once, 'sla:RFI:RFI-014').tierLabel, '1x');

  const twice = evaluateAlerts({ asOf, config, rfi: { entries: [{ ...entry, date: '2026-06-15' }] } });
  assert.equal(find(twice, 'sla:RFI:RFI-014').tierLabel, '2x');
  assert.match(find(twice, 'sla:RFI:RFI-014').detail, /14-day contractual response period/);
});

test('within the response period there is nothing to say', () => {
  const alerts = evaluateAlerts({
    asOf,
    config: { contract: { rfiResponseDays: 14 } },
    rfi: { entries: [{ ref: 'RFI-020', date: '2026-08-01', status: 'open' }] },
  });
  assert.equal(alerts.length, 0);
});

test('with no response period in the contract config, no SLA alert is invented', () => {
  const alerts = evaluateAlerts({
    asOf,
    config: { contract: {} },
    rfi: { entries: [{ ref: 'RFI-021', date: '2020-01-01', status: 'open' }] },
  });
  assert.equal(alerts.length, 0);
});

// --- procurement -----------------------------------------------------------

test('the order-by date is derived from the linked activity, not stated by hand', () => {
  // A-1300 starts 2026-06-22 in the fixture; 30 days lead means order by 2026-05-23.
  const alerts = evaluateAlerts({
    asOf: '2026-05-20',
    programme,
    procurement: {
      entries: [
        { ref: 'PRC-001', item: 'MEP containment', supplier: 'Acme', activity: 'A-1300', leadTimeDays: 30, status: 'open' },
      ],
    },
  });

  const alert = find(alerts, 'procure:PRC-001');
  assert.equal(alert.meta.orderBy, '2026-05-23');
  assert.equal(alert.meta.needOnSite, '2026-06-22');
  assert.match(alert.detail, /must be ordered by 23 May 2026/);
});

test('lead time in weeks is accepted, because that is how it gets written', () => {
  const alerts = evaluateAlerts({
    asOf: '2026-05-20',
    programme,
    procurement: {
      entries: [{ ref: 'PRC-002', item: 'Blocks', activity: 'A-1300', leadTimeWeeks: 4, status: 'open' }],
    },
  });
  assert.equal(find(alerts, 'procure:PRC-002').meta.leadDays, 28);
});

test('an ordered item stops alerting', () => {
  const alerts = evaluateAlerts({
    asOf: '2026-05-20',
    programme,
    procurement: {
      entries: [{ ref: 'PRC-003', activity: 'A-1300', leadTimeDays: 30, status: 'ordered' }],
    },
  });
  assert.equal(find(alerts, 'procure:PRC-003'), undefined);
});

test('an item linked to an activity that has left the programme is flagged, not dropped', () => {
  // The contractor deleted or renumbered the activity between revisions. Without
  // this the item falls silent exactly when it most needs saying.
  const alerts = evaluateAlerts({
    asOf: '2026-05-20',
    programme,
    procurement: {
      entries: [{ ref: 'PRC-009', item: 'Facade stone', activity: 'A-9999', leadTimeWeeks: 12, status: 'open' }],
    },
  });

  const alert = find(alerts, 'procure:PRC-009:orphaned');
  assert.equal(alert.tierLabel, 'orphaned');
  assert.match(alert.detail, /A-9999, which is not in the current programme/);
});

test('an orphaned link is not flagged when a need-on-site date was recorded by hand', () => {
  const alerts = evaluateAlerts({
    asOf: '2026-05-20',
    programme,
    procurement: {
      entries: [
        { ref: 'PRC-010', item: 'Stone', activity: 'A-9999', needOnSite: '2026-06-22', leadTimeDays: 30, status: 'open' },
      ],
    },
  });
  assert.equal(find(alerts, 'procure:PRC-010:orphaned'), undefined);
  assert.equal(find(alerts, 'procure:PRC-010').meta.orderBy, '2026-05-23');
});

test('overdue wording is singular for one day', () => {
  const alerts = evaluateAlerts({
    asOf,
    decisions: { entries: [{ ref: 'DEC-009', subject: 'One day late', dueDate: '2026-08-04' }] },
  });
  assert.match(find(alerts, 'decision:DEC-009').title, /1 day overdue/);
});

test('an item with no lead time cannot be alerted on, and is not guessed at', () => {
  const alerts = evaluateAlerts({
    asOf: '2026-05-20',
    programme,
    procurement: { entries: [{ ref: 'PRC-004', activity: 'A-1300', status: 'open' }] },
  });
  assert.equal(find(alerts, 'procure:PRC-004'), undefined);
});

// --- float -----------------------------------------------------------------

const negative = normalizeProgramme(
  parseXerText(
    makeXer({
      ...BASE_PROGRAMME,
      activities: [
        { ...BASE_PROGRAMME.activities[2], totalFloatDays: -3 },
        { ...BASE_PROGRAMME.activities[4] },
      ],
      relationships: [],
    }),
  ),
);

test('an activity in negative float alerts', () => {
  const alerts = evaluateAlerts({ asOf, programme: negative });
  const alert = find(alerts, 'float:A-1240');
  assert.equal(alert.tierLabel, 'negative');
  assert.match(alert.detail, /driving the completion date/);
});

test('float that stays the same does not escalate; float that worsens does', () => {
  const worse = normalizeProgramme(
    parseXerText(
      makeXer({
        ...BASE_PROGRAMME,
        activities: [{ ...BASE_PROGRAMME.activities[2], totalFloatDays: -12 }],
        relationships: [],
      }),
    ),
  );

  const unchanged = evaluateAlerts({ asOf, programme: negative, previousProgramme: negative });
  assert.equal(find(unchanged, 'float:A-1240').tier, 1);

  const worsened = evaluateAlerts({ asOf, programme: worse, previousProgramme: negative });
  assert.equal(find(worsened, 'float:A-1240').tier, 2);
  assert.match(find(worsened, 'float:A-1240').detail, /worsened from -3d/);
});

test('positive float is not an alert', () => {
  const alerts = evaluateAlerts({ asOf, programme });
  assert.equal(alerts.filter((a) => a.condition === CONDITIONS.FLOAT).length, 0);
});

// --- stale programme -------------------------------------------------------

test('a stale programme is flagged, because every other alert depends on it', () => {
  const alerts = evaluateAlerts({ asOf: '2026-07-20', programme });
  const alert = find(alerts, 'stale');
  assert.equal(alert.tierLabel, '10d');
  assert.match(alert.title, /19 days old/);
});

test('a fresh programme is not flagged', () => {
  const alerts = evaluateAlerts({ asOf: '2026-07-03', programme });
  assert.equal(find(alerts, 'stale'), undefined);
});

// --- the quiet rule --------------------------------------------------------

const candidate = (tier, key = 'notice:EV-001') => ({
  key,
  condition: 'notice',
  ref: 'EV-001',
  tier,
  tierLabel: `t${tier}`,
  severity: 'high',
  title: `Notice at tier ${tier}`,
  detail: 'detail',
  due: '2026-08-10',
});

test('a new condition is sent', () => {
  const result = reconcile([candidate(1)], { entries: [] }, { asOf });
  assert.equal(result.toSend.length, 1);
  assert.equal(result.toSend[0].reason, 'new');
  assert.equal(result.state.entries[0].timesSent, 1);
});

test('the same condition at the same tier is silent on the next run', () => {
  const first = reconcile([candidate(1)], { entries: [] }, { asOf });
  const second = reconcile([candidate(1)], first.state, { asOf: '2026-08-06' });

  assert.equal(second.toSend.length, 0, 'an alerter that repeats itself gets muted');
  assert.equal(second.open.length, 1, 'but it stays open and listable');
  assert.equal(second.state.entries[0].timesSent, 1);
});

test('a raised tier is sent again', () => {
  const first = reconcile([candidate(1)], { entries: [] }, { asOf });
  const second = reconcile([candidate(3)], first.state, { asOf: '2026-08-08' });

  assert.equal(second.toSend.length, 1);
  assert.equal(second.toSend[0].reason, 'escalated');
  assert.equal(second.state.entries[0].timesSent, 2);
  assert.equal(second.state.entries[0].lastSentTier, 3);
});

test('a tier that falls back does not re-send', () => {
  const first = reconcile([candidate(3)], { entries: [] }, { asOf });
  const second = reconcile([candidate(1)], first.state, { asOf: '2026-08-09' });
  assert.equal(second.toSend.length, 0);
  assert.equal(second.state.entries[0].tier, 1, 'but the current position is still recorded');
});

test('a condition that stops firing is resolved', () => {
  const first = reconcile([candidate(1)], { entries: [] }, { asOf });
  const second = reconcile([], first.state, { asOf: '2026-08-10' });

  assert.equal(second.resolved.length, 1);
  assert.equal(second.open.length, 0);
  assert.equal(second.state.entries[0].resolvedAt, '2026-08-10');
});

test('a condition that clears and returns alerts again', () => {
  // Genuinely news: it was dealt with and has come back.
  const first = reconcile([candidate(1)], { entries: [] }, { asOf });
  const cleared = reconcile([], first.state, { asOf: '2026-08-10' });
  const returned = reconcile([candidate(1)], cleared.state, { asOf: '2026-08-20' });

  assert.equal(returned.toSend.length, 1);
  assert.equal(returned.toSend[0].reason, 'new');
  assert.equal(returned.state.entries.length, 2, 'the resolved entry is kept as record');
});

test('the description is refreshed even when nothing is sent', () => {
  const first = reconcile([candidate(1)], { entries: [] }, { asOf });
  const updated = { ...candidate(1), title: 'Now says something else', due: '2026-09-01' };
  const second = reconcile([updated], first.state, { asOf: '2026-08-06' });

  assert.equal(second.toSend.length, 0);
  assert.equal(second.state.entries[0].title, 'Now says something else');
  assert.equal(second.state.entries[0].due, '2026-09-01');
});

test('a snoozed alert stays silent until its date, then escalates normally', () => {
  const first = reconcile([candidate(1)], { entries: [] }, { asOf });
  snooze(first.state, 'notice:EV-001', '2026-08-15');

  const during = reconcile([candidate(3)], first.state, { asOf: '2026-08-10' });
  assert.equal(during.toSend.length, 0, 'snoozed, despite escalating');

  const after = reconcile([candidate(3)], during.state, { asOf: '2026-08-16' });
  assert.equal(after.toSend.length, 1);
});

test('independent keys are tracked independently', () => {
  const first = reconcile([candidate(1, 'notice:EV-001')], { entries: [] }, { asOf });
  const second = reconcile(
    [candidate(1, 'notice:EV-001'), candidate(1, 'decision:DEC-001')],
    first.state,
    { asOf: '2026-08-06' },
  );

  assert.equal(second.toSend.length, 1);
  assert.equal(second.toSend[0].key, 'decision:DEC-001');
  assert.equal(second.open.length, 2);
});
