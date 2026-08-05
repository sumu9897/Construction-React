/**
 * Alert conditions, as pure functions.
 *
 * Every condition produces a stable `key` and an escalating `tier`. The tier is what
 * makes the alerter quiet: state.js sends on a new key or a raised tier, and stays
 * silent otherwise. An alerter that repeats itself every morning gets muted, and a
 * muted alerter is worse than none at all.
 *
 * Nothing here touches the filesystem, so the tiering - the part most likely to be
 * subtly wrong - is fully testable.
 */

import { daysBetween, dayOf, addDays, formatHuman } from '../util/dates.js';
import {
  entriesOf,
  isOpen,
  raisedOn,
  dueOn,
  subjectOf,
  ownerOf,
  procurementDates,
} from '../ledger/registers.js';

export const CONDITIONS = {
  NOTICE: 'notice',
  DECISION: 'decision',
  ACTION: 'action',
  SLA: 'sla',
  PROCUREMENT: 'procure',
  FLOAT: 'float',
  STALE: 'stale',
};

/**
 * Map "days remaining" onto an escalating tier.
 *
 * `thresholds` ascending, tightest first: [3, 7, 14] means a tier at 14 days out,
 * a higher one at 7, higher again at 3, and the highest once it has passed. A
 * higher index always means "worse", which is the only property state.js relies on.
 */
export function dateTier(daysRemaining, thresholds) {
  if (daysRemaining === null || daysRemaining === undefined) return null;
  if (daysRemaining < 0) {
    return { index: thresholds.length + 1, label: 'overdue' };
  }
  for (let i = 0; i < thresholds.length; i++) {
    if (daysRemaining <= thresholds[i]) {
      return { index: thresholds.length - i, label: `${thresholds[i]}d` };
    }
  }
  return null; // not yet close enough to be worth saying anything
}

/** Age-based tiers, where larger is worse: [10, 21] ascending. */
export function ageTier(ageDays, thresholds) {
  if (ageDays === null || ageDays === undefined) return null;
  let tier = null;
  for (let i = 0; i < thresholds.length; i++) {
    if (ageDays >= thresholds[i]) tier = { index: i + 1, label: `${thresholds[i]}d` };
  }
  return tier;
}

const severityOf = (tierIndex, max) =>
  tierIndex >= max ? 'critical' : tierIndex >= max - 1 ? 'high' : 'medium';

const plural = (n, word) => `${n} ${word}${Math.abs(n) === 1 ? '' : 's'}`;

const dueWording = (days) => {
  if (days === null) return '';
  if (days < 0) return `${plural(Math.abs(days), 'day')} overdue`;
  if (days === 0) return 'due today';
  return `due in ${plural(days, 'day')}`;
};

// --- conditions ------------------------------------------------------------

/**
 * Contractual notice deadlines. The highest-value alert in the system: entitlement
 * is lost on missed notice periods far more often than on weak merits.
 */
function noticeAlerts({ events, asOf, thresholds }) {
  const alerts = [];

  for (const event of entriesOf(events)) {
    if (event.noticeIssued) continue;
    const deadline = dayOf(event.noticeDeadline);
    if (!deadline) continue;

    const remaining = daysBetween(asOf, deadline);
    const tier = dateTier(remaining, thresholds);
    if (!tier) continue;

    alerts.push({
      key: `${CONDITIONS.NOTICE}:${event.ref}`,
      condition: CONDITIONS.NOTICE,
      tier: tier.index,
      tierLabel: tier.label,
      severity: severityOf(tier.index, thresholds.length + 1),
      ref: event.ref,
      activity: event.activity ?? null,
      due: deadline,
      title: `Notice ${dueWording(remaining)} — ${event.ref}`,
      detail:
        `Delay event ${event.ref}${event.activity ? ` on ${event.activity}` : ''} ` +
        `logged ${formatHuman(event.date)}. Notice due by ${formatHuman(deadline)}. ` +
        `No notice recorded as issued.`,
    });
  }

  return alerts;
}

/** Decisions and actions share a shape, so they share an evaluator. */
function dueRegisterAlerts(register, { condition, asOf, thresholds, noun }) {
  const alerts = [];

  for (const entry of entriesOf(register)) {
    if (!isOpen(entry)) continue;
    const due = dueOn(entry);
    if (!due) continue;

    const remaining = daysBetween(asOf, due);
    const tier = dateTier(remaining, thresholds);
    if (!tier) continue;

    const owner = ownerOf(entry) ?? 'nobody assigned';
    alerts.push({
      key: `${condition}:${entry.ref}`,
      condition,
      tier: tier.index,
      tierLabel: tier.label,
      severity: severityOf(tier.index, thresholds.length + 1),
      ref: entry.ref,
      activity: entry.activity ?? null,
      owner: ownerOf(entry),
      due,
      title: `${noun} ${dueWording(remaining)} — ${subjectOf(entry)}`,
      detail:
        `${subjectOf(entry)}. With ${owner}, due ${formatHuman(due)}.` +
        (entry.consequence ? ` If late: ${entry.consequence}` : ''),
    });
  }

  return alerts;
}

/**
 * Items sitting beyond the contractual response period.
 *
 * Reported factually with dates, because when the other side is late this is the
 * contractor's evidence for late information - not a complaint.
 */
function slaAlerts(register, { name, responseDays, asOf }) {
  if (!responseDays) return [];
  const alerts = [];

  for (const entry of entriesOf(register)) {
    if (!isOpen(entry)) continue;
    const raised = raisedOn(entry);
    if (!raised) continue;

    const daysOpen = daysBetween(raised, asOf);
    if (daysOpen === null || daysOpen <= responseDays) continue;

    // Two tiers only: past the period, and past twice the period.
    const tier = daysOpen > responseDays * 2 ? { index: 2, label: '2x' } : { index: 1, label: '1x' };

    alerts.push({
      key: `${CONDITIONS.SLA}:${name}:${entry.ref}`,
      condition: CONDITIONS.SLA,
      tier: tier.index,
      tierLabel: tier.label,
      severity: severityOf(tier.index, 2),
      ref: entry.ref,
      activity: entry.activity ?? null,
      owner: ownerOf(entry),
      due: addDays(raised, responseDays),
      title: `${name} ${entry.ref} open ${daysOpen}d against a ${responseDays}d period`,
      detail:
        `${subjectOf(entry)}. Raised ${formatHuman(raised)}, with ` +
        `${ownerOf(entry) ?? 'unassigned'}, ${daysOpen} days open against a ` +
        `${responseDays}-day contractual response period.`,
    });
  }

  return alerts;
}

/**
 * Procurement order-by dates, derived from the live programme.
 *
 * Need-on-site comes from the linked activity's planned start, so the order-by date
 * moves when the schedule moves. A static list of dates goes stale the first time
 * the programme is revised, which is precisely when it matters.
 */
function procurementAlerts({ procurement, programme, asOf, thresholds }) {
  const alerts = [];
  if (!programme) return alerts;

  const byCode = new Map(programme.activities.map((a) => [a.code ?? a.id, a]));

  for (const entry of entriesOf(procurement)) {
    if (!isOpen(entry)) continue;

    const { leadDays: lead, needOnSite, orderBy, orphaned, activity } = procurementDates(entry, byCode);

    // An open item pointing at an activity that is no longer in the programme
    // cannot have an order-by date derived, so it would otherwise fall silent -
    // exactly when it most needs saying. This happens when a contractor deletes
    // or renumbers an activity between revisions.
    if (orphaned) {
      alerts.push({
        key: `${CONDITIONS.PROCUREMENT}:${entry.ref}:orphaned`,
        condition: CONDITIONS.PROCUREMENT,
        tier: 1,
        tierLabel: 'orphaned',
        severity: 'high',
        ref: entry.ref,
        activity: entry.activity,
        due: null,
        title: `${subjectOf(entry)} is no longer linked to the programme`,
        detail:
          `${subjectOf(entry)} is linked to activity ${entry.activity}, which is not in ` +
          `the current programme. No order-by date can be derived until it is relinked ` +
          `or a need-on-site date is recorded.`,
      });
      continue;
    }

    if (!orderBy) continue;

    const remaining = daysBetween(asOf, orderBy);
    const tier = dateTier(remaining, thresholds);
    if (!tier) continue;

    alerts.push({
      key: `${CONDITIONS.PROCUREMENT}:${entry.ref}`,
      condition: CONDITIONS.PROCUREMENT,
      tier: tier.index,
      tierLabel: tier.label,
      severity: severityOf(tier.index, thresholds.length + 1),
      ref: entry.ref,
      activity: entry.activity ?? null,
      owner: entry.supplier ?? null,
      due: orderBy,
      title: `Order ${dueWording(remaining)} — ${subjectOf(entry)}`,
      detail:
        `${subjectOf(entry)}${entry.supplier ? ` (${entry.supplier})` : ''}. ` +
        `Needed on site ${formatHuman(needOnSite)}` +
        `${activity ? ` for ${entry.activity}` : ''}, lead time ${lead} days, ` +
        `so it must be ordered by ${formatHuman(orderBy)}.`,
      meta: { needOnSite, orderBy, leadDays: lead },
    });
  }

  return alerts;
}

/**
 * Activities in negative float.
 *
 * Tier 1 on crossing into negative; tier 2 only if it materially worsens. Without
 * the second condition a project sitting at -3 days would alert forever.
 */
function floatAlerts({ programme, previousProgramme, asOf, worseningDays }) {
  const alerts = [];
  if (!programme) return alerts;

  const before = new Map(
    (previousProgramme?.activities ?? []).map((a) => [a.code ?? a.id, a.totalFloatDays]),
  );

  for (const activity of programme.activities) {
    if (activity.status === 'complete') continue;
    const float = activity.totalFloatDays;
    if (float === null || float >= 0) continue;

    const previous = before.get(activity.code ?? activity.id);
    const worsened = previous !== undefined && previous !== null && float <= previous - worseningDays;
    const tier = worsened ? { index: 2, label: 'worsening' } : { index: 1, label: 'negative' };

    alerts.push({
      key: `${CONDITIONS.FLOAT}:${activity.code ?? activity.id}`,
      condition: CONDITIONS.FLOAT,
      tier: tier.index,
      tierLabel: tier.label,
      severity: severityOf(tier.index, 2),
      ref: activity.code,
      activity: activity.code,
      due: dayOf(activity.planFinish),
      title: `${activity.code} at ${float}d float`,
      detail:
        `${activity.code} ${activity.name ?? ''} is showing ${float} days of float` +
        (worsened ? `, worsened from ${previous}d since the last update` : '') +
        `. It is driving the completion date.`,
    });
  }

  return alerts;
}

/** A stale programme makes every other alert here suspect. */
function staleAlerts({ programme, asOf, thresholds }) {
  if (!programme?.project?.dataDateDay) return [];

  const age = daysBetween(programme.project.dataDateDay, asOf);
  const tier = ageTier(age, thresholds);
  if (!tier) return [];

  return [
    {
      key: CONDITIONS.STALE,
      condition: CONDITIONS.STALE,
      tier: tier.index,
      tierLabel: tier.label,
      severity: severityOf(tier.index, thresholds.length),
      due: null,
      title: `Programme is ${age} days old`,
      detail:
        `The last P6 update has a data date of ${formatHuman(programme.project.dataDateDay)}, ` +
        `${age} days ago. Every date and float figure in the alerts and reports is ` +
        `computed from it.`,
    },
  ];
}

// --- entry point -----------------------------------------------------------

export const DEFAULT_THRESHOLDS = {
  notice: [3, 7, 14],
  decision: [3, 7],
  action: [3, 7],
  procurement: [7, 14],
  stale: [10, 21],
  floatWorseningDays: 5,
};

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2 };

/**
 * @param {object} input everything already loaded from the ledger
 * @returns {Array<object>} candidate alerts, worst first
 */
export function evaluateAlerts(input) {
  const {
    asOf,
    config = {},
    programme = null,
    previousProgramme = null,
    events = null,
    decisions = null,
    actions = null,
    rfi = null,
    submittals = null,
    procurement = null,
  } = input;

  const thresholds = { ...DEFAULT_THRESHOLDS, ...(config.alerts ?? {}) };
  const contract = config.contract ?? {};

  const alerts = [
    ...noticeAlerts({ events, asOf, thresholds: thresholds.notice }),
    ...dueRegisterAlerts(decisions, {
      condition: CONDITIONS.DECISION,
      asOf,
      thresholds: thresholds.decision,
      noun: 'Decision',
    }),
    ...dueRegisterAlerts(actions, {
      condition: CONDITIONS.ACTION,
      asOf,
      thresholds: thresholds.action,
      noun: 'Action',
    }),
    ...slaAlerts(rfi, { name: 'RFI', responseDays: contract.rfiResponseDays, asOf }),
    ...slaAlerts(submittals, {
      name: 'Submittal',
      responseDays: contract.submittalResponseDays,
      asOf,
    }),
    ...procurementAlerts({ procurement, programme, asOf, thresholds: thresholds.procurement }),
    ...floatAlerts({
      programme,
      previousProgramme,
      asOf,
      worseningDays: thresholds.floatWorseningDays,
    }),
    ...staleAlerts({ programme, asOf, thresholds: thresholds.stale }),
  ];

  return alerts.sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      (a.due ?? '9999').localeCompare(b.due ?? '9999'),
  );
}

export const _internals = { noticeAlerts, dueRegisterAlerts, slaAlerts, procurementAlerts, floatAlerts, staleAlerts };
