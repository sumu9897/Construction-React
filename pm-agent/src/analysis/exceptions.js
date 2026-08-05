/**
 * The exception engine - what the agent actually asks you about each morning.
 *
 * The design decision that makes the daily chase survivable: never ask about
 * "all activities in the window". Ask only about activities where reality has
 * diverged from the programme, or is about to. On a 4,000-activity project that
 * turns a useless wall of text into five or six real questions.
 */

import { daysBetween, dayOf, addDays, formatHuman } from '../util/dates.js';

/**
 * Exception kinds, ordered by how much they should worry you. Order matters:
 * an activity can qualify for several and we report only its worst.
 */
export const KINDS = {
  NEGATIVE_FLOAT: 'negative-float',
  OVERDUE_FINISH: 'overdue-finish',
  OVERDUE_START: 'overdue-start',
  SLIPPING: 'slipping',
  STARTING_CRITICAL: 'starting-critical',
  FINISHING_SOON: 'finishing-soon',
};

const KIND_RANK = [
  KINDS.NEGATIVE_FLOAT,
  KINDS.OVERDUE_FINISH,
  KINDS.OVERDUE_START,
  KINDS.SLIPPING,
  KINDS.STARTING_CRITICAL,
  KINDS.FINISHING_SOON,
];

const IGNORED_TYPES = new Set(['level-of-effort', 'wbs-summary']);

function isMilestone(activity) {
  return activity.type === 'start-milestone' || activity.type === 'finish-milestone';
}

/**
 * Severity blends lateness with float. Being three days late on an activity
 * with 40 days of float is noise; being one day late with -2 days of float is
 * the completion date moving. Float dominates deliberately.
 */
function severityOf({ daysLate = 0, floatDays }) {
  const float = floatDays ?? 999;
  let score = 0;

  if (float < 0) score += 100 + Math.min(50, Math.abs(float) * 5);
  else if (float === 0) score += 80;
  else if (float <= 5) score += 60;
  else if (float <= 10) score += 40;
  else if (float <= 20) score += 20;

  score += Math.min(40, Math.max(0, daysLate) * 4);
  return score;
}

function label(activity) {
  return `${activity.code ?? activity.id} ${activity.name ?? ''}`.trim();
}

/**
 * Float phrased the way it gets said in a site meeting, not as a raw number.
 */
function floatPhrase(floatDays) {
  if (floatDays === null || floatDays === undefined) return '';
  if (floatDays < 0) return `${Math.abs(floatDays)}d BEHIND the critical path`;
  if (floatDays === 0) return 'on the critical path, zero float';
  if (floatDays <= 10) return `${floatDays}d float left`;
  return `${floatDays}d float`;
}

function buildQuestion(kind, activity, detail) {
  const name = label(activity);
  const float = floatPhrase(activity.totalFloatDays);
  const suffix = float ? ` (${float})` : '';

  switch (kind) {
    case KINDS.OVERDUE_START:
      return `*${name}* was due to start ${formatHuman(activity.planStart)} — ${detail.daysLate}d ago. Has it started?${suffix}`;
    case KINDS.OVERDUE_FINISH:
      return `*${name}* was due to finish ${formatHuman(activity.planFinish)} — ${detail.daysLate}d ago. Is it complete? If not, what % and when will it finish?${suffix}`;
    case KINDS.NEGATIVE_FLOAT:
      return `*${name}* is showing ${Math.abs(activity.totalFloatDays)}d negative float — it is driving the end date. What is the current status and recovery plan?`;
    case KINDS.SLIPPING:
      return `*${name}* is ${activity.percentComplete}% done with ${activity.remainingDays}d remaining, which lands it ${detail.daysLate}d past its ${formatHuman(activity.planFinish)} finish. Still realistic?${suffix}`;
    case KINDS.STARTING_CRITICAL:
      return `*${name}* starts ${formatHuman(activity.planStart)} (in ${detail.daysUntil}d) and is critical. Is everything in place to start — materials, approvals, access?${suffix}`;
    case KINDS.FINISHING_SOON:
      return `*${name}* is due to finish ${formatHuman(activity.planFinish)} (in ${detail.daysUntil}d) at ${activity.percentComplete}%. On track?${suffix}`;
    default:
      return `*${name}* — status?`;
  }
}

/**
 * Classify one activity. Returns the single worst applicable exception, or null.
 */
function classify(activity, asOf, config) {
  if (IGNORED_TYPES.has(activity.type)) return null;
  if (activity.status === 'complete') return null;

  const nearCritical = config.nearCriticalFloatDays ?? 10;
  const lookahead = config.lookaheadDays ?? 14;
  const float = activity.totalFloatDays;
  const candidates = [];

  const planStartDay = dayOf(activity.planStart ?? activity.earlyStart);
  const planFinishDay = dayOf(activity.planFinish ?? activity.earlyFinish);

  // Negative float: the completion date has already moved.
  if (float !== null && float < 0) {
    candidates.push({ kind: KINDS.NEGATIVE_FLOAT, detail: {} });
  }

  // Should have finished by now.
  if (planFinishDay) {
    const late = daysBetween(planFinishDay, asOf);
    if (late !== null && late > 0) {
      candidates.push({ kind: KINDS.OVERDUE_FINISH, detail: { daysLate: late } });
    } else if (late !== null && late <= 0 && Math.abs(late) <= lookahead) {
      // Finishing inside the window - only worth asking about if it is already
      // running and matters to the end date.
      if (activity.status === 'in-progress' && (float ?? 999) <= nearCritical) {
        candidates.push({ kind: KINDS.FINISHING_SOON, detail: { daysUntil: Math.abs(late) } });
      }
    }
  }

  // Should have started by now.
  if (activity.status === 'not-started' && planStartDay) {
    const late = daysBetween(planStartDay, asOf);
    if (late !== null && late > 0) {
      candidates.push({ kind: KINDS.OVERDUE_START, detail: { daysLate: late } });
    } else if (late !== null && Math.abs(late) <= lookahead && (float ?? 999) <= nearCritical) {
      candidates.push({ kind: KINDS.STARTING_CRITICAL, detail: { daysUntil: Math.abs(late) } });
    }
  }

  // In progress but the remaining duration no longer fits before the planned
  // finish. This is the early warning that fires before the finish date passes.
  if (
    activity.status === 'in-progress' &&
    activity.remainingDays !== null &&
    planFinishDay &&
    !isMilestone(activity)
  ) {
    const projectedFinish = addDays(asOf, Math.ceil(activity.remainingDays));
    const overrun = daysBetween(planFinishDay, projectedFinish);
    if (overrun !== null && overrun > 0) {
      candidates.push({ kind: KINDS.SLIPPING, detail: { daysLate: overrun, projectedFinish } });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => KIND_RANK.indexOf(a.kind) - KIND_RANK.indexOf(b.kind));
  const best = candidates[0];

  return {
    activityId: activity.id,
    code: activity.code,
    name: activity.name,
    wbsPath: activity.wbsPath,
    kind: best.kind,
    detail: best.detail,
    status: activity.status,
    percentComplete: activity.percentComplete,
    remainingDays: activity.remainingDays,
    planStart: activity.planStart,
    planFinish: activity.planFinish,
    totalFloatDays: float,
    critical: activity.critical,
    severity: severityOf({ daysLate: best.detail.daysLate ?? 0, floatDays: float }),
    question: buildQuestion(best.kind, activity, best.detail),
    alsoFlagged: candidates.slice(1).map((c) => c.kind),
  };
}

/**
 * @param {object} programme        normalized programme
 * @param {object} options
 * @param {string} options.asOf     YYYY-MM-DD, defaults to the programme data date
 * @param {object} options.config   project.yaml chase config
 * @param {object} options.progress progress.yaml, used to avoid re-asking
 * @param {number} options.limit    max exceptions to return
 */
export function computeExceptions(programme, options = {}) {
  const config = options.config ?? {};
  const asOf = options.asOf ?? programme.project.dataDateDay;
  const progress = options.progress?.activities ?? {};
  const limit = options.limit ?? config.maxQuestionsPerSession ?? 6;

  if (!asOf) {
    throw new Error('Cannot compute exceptions: no as-of date and programme has no data date');
  }

  const all = [];
  for (const activity of programme.activities) {
    const exception = classify(activity, asOf, config);
    if (exception) all.push(exception);
  }

  // Suppress anything already answered today, so a second run of the chase does
  // not ask the same question twice.
  const answeredToday = new Set(
    Object.entries(progress)
      .filter(([, entry]) => dayOf(entry.updatedAt) === asOf)
      .map(([code]) => code),
  );

  const pending = all.filter((e) => !answeredToday.has(e.code ?? e.activityId));
  pending.sort((a, b) => b.severity - a.severity);

  return {
    asOf,
    dataDate: programme.project.dataDateDay,
    // A stale programme makes every exception suspect - surface it loudly
    // rather than letting the agent ask confident questions off old data.
    programmeAgeDays: daysBetween(programme.project.dataDateDay, asOf),
    total: all.length,
    suppressed: all.length - pending.length,
    byKind: KIND_RANK.reduce((acc, kind) => {
      acc[kind] = all.filter((e) => e.kind === kind).length;
      return acc;
    }, {}),
    questions: pending.slice(0, limit),
    remaining: Math.max(0, pending.length - limit),
    all: pending,
  };
}
