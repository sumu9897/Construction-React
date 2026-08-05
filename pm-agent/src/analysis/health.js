/**
 * DCMA 14-point schedule health check.
 *
 * Run this on any programme before you accept it. As PMC or client-side it is
 * how you reject a bad baseline in an hour instead of living with it for two
 * years. As contractor, run it on your own submission first.
 *
 * Checks 12-14 (critical path test, CPLI, BEI) need a baseline and a
 * perturbation run, so they are reported as requiring input rather than
 * silently passed.
 */

import { daysBetween, dayOf } from '../util/dates.js';

const EXCLUDED = new Set(['level-of-effort', 'wbs-summary']);
const HIGH_FLOAT_DAYS = 44;
const HIGH_DURATION_DAYS = 44;
const THRESHOLD_PERCENT = 5;

const pct = (n, total) => (total === 0 ? 0 : Math.round((n / total) * 1000) / 10);

function check(name, { count, total, threshold, limitIsZero = false, detail = [], note }) {
  const percent = pct(count, total);
  const passed = limitIsZero ? count === 0 : percent <= threshold;
  return {
    name,
    count,
    total,
    percent,
    threshold: limitIsZero ? 0 : threshold,
    passed,
    note,
    // Cap the sample - a full list of 900 offending activity codes is not
    // actionable, the first handful plus a count is.
    examples: detail.slice(0, 15),
  };
}

export function checkProgrammeHealth(programme, options = {}) {
  const baseline = options.baseline ?? null;
  const dataDate = programme.project.dataDateDay;

  const activities = programme.activities.filter((a) => !EXCLUDED.has(a.type));
  const incomplete = activities.filter((a) => a.status !== 'complete');
  const total = activities.length;

  const hasPredecessor = new Set(programme.relationships.map((r) => r.successorId));
  const hasSuccessor = new Set(programme.relationships.map((r) => r.predecessorId));

  // 1. Logic - dangling activities. First and last activity legitimately dangle.
  const dangling = activities.filter(
    (a) => !hasPredecessor.has(a.id) || !hasSuccessor.has(a.id),
  );

  // 2 & 3. Leads (negative lag) and lags.
  const leads = programme.relationships.filter((r) => (r.lagDays ?? 0) < 0);
  const lags = programme.relationships.filter((r) => (r.lagDays ?? 0) > 0);

  // 4. Relationship types - FS should dominate.
  const nonFs = programme.relationships.filter((r) => r.type !== 'FS');

  // 5. Hard constraints.
  const hardConstraints = activities.filter((a) => a.constraintIsHard);

  // 6 & 7. Float.
  const highFloat = incomplete.filter((a) => (a.totalFloatDays ?? 0) > HIGH_FLOAT_DAYS);
  const negativeFloat = incomplete.filter((a) => (a.totalFloatDays ?? 0) < 0);

  // 8. High duration.
  const highDuration = incomplete.filter((a) => (a.durationDays ?? 0) > HIGH_DURATION_DAYS);

  // 9. Invalid dates - actuals in the future, forecasts in the past.
  const invalidDates = activities.filter((a) => {
    if (!dataDate) return false;
    const actualAfterDataDate =
      (a.actualStart && daysBetween(dataDate, a.actualStart) > 0) ||
      (a.actualFinish && daysBetween(dataDate, a.actualFinish) > 0);
    const forecastBeforeDataDate =
      a.status !== 'complete' &&
      a.earlyFinish &&
      daysBetween(a.earlyFinish, dataDate) > 0;
    return actualAfterDataDate || forecastBeforeDataDate;
  });

  // 10. Resources - only meaningful if the programme is resource loaded at all.
  const resourceLoaded = activities.some((a) => a.budgetCost !== undefined);
  const missingResources = resourceLoaded
    ? activities.filter((a) => (a.durationDays ?? 0) > 0 && a.budgetCost === undefined)
    : [];

  // 11. Missed tasks - finished later than the baseline said, or should have
  // finished by the data date and has not.
  let missed = [];
  if (baseline) {
    const baselineByCode = new Map(baseline.activities.map((a) => [a.code ?? a.id, a]));
    missed = activities.filter((a) => {
      const base = baselineByCode.get(a.code ?? a.id);
      if (!base?.planFinish) return false;
      if (a.actualFinish) return daysBetween(base.planFinish, a.actualFinish) > 0;
      return dataDate ? daysBetween(base.planFinish, dataDate) > 0 : false;
    });
  }

  const codes = (list) => list.map((a) => `${a.code ?? a.id} ${a.name ?? ''}`.trim());
  const links = (list) => list.map((r) => `${r.predecessorId}->${r.successorId} ${r.type}${r.lagDays ? ` +${r.lagDays}d` : ''}`);

  const checks = [
    check('1. Logic (missing predecessor or successor)', {
      count: dangling.length,
      total,
      threshold: THRESHOLD_PERCENT,
      detail: codes(dangling),
    }),
    check('2. Leads (negative lag)', {
      count: leads.length,
      total: programme.relationships.length,
      limitIsZero: true,
      detail: links(leads),
      note: 'Negative lag hides true logic and should not appear at all.',
    }),
    check('3. Lags', {
      count: lags.length,
      total: programme.relationships.length,
      threshold: THRESHOLD_PERCENT,
      detail: links(lags),
    }),
    check('4. Relationship types (non finish-to-start)', {
      count: nonFs.length,
      total: programme.relationships.length,
      threshold: 10,
      detail: links(nonFs),
      note: 'At least 90% of links should be FS.',
    }),
    check('5. Hard constraints', {
      count: hardConstraints.length,
      total,
      threshold: THRESHOLD_PERCENT,
      detail: codes(hardConstraints),
      note: 'Hard constraints override logic and mask real slippage.',
    }),
    check(`6. High float (> ${HIGH_FLOAT_DAYS}d)`, {
      count: highFloat.length,
      total: incomplete.length,
      threshold: THRESHOLD_PERCENT,
      detail: codes(highFloat),
      note: 'Usually a symptom of missing logic rather than genuine slack.',
    }),
    check('7. Negative float', {
      count: negativeFloat.length,
      total: incomplete.length,
      limitIsZero: true,
      detail: codes(negativeFloat),
    }),
    check(`8. High duration (> ${HIGH_DURATION_DAYS}d)`, {
      count: highDuration.length,
      total: incomplete.length,
      threshold: THRESHOLD_PERCENT,
      detail: codes(highDuration),
    }),
    check('9. Invalid dates', {
      count: invalidDates.length,
      total,
      limitIsZero: true,
      detail: codes(invalidDates),
      note: 'Actual dates after the data date, or forecasts before it.',
    }),
    check('10. Resources assigned', {
      count: missingResources.length,
      total,
      threshold: THRESHOLD_PERCENT,
      detail: codes(missingResources),
      note: resourceLoaded
        ? undefined
        : 'Programme is not resource or cost loaded - check not applicable.',
    }),
    check('11. Missed tasks vs baseline', {
      count: missed.length,
      total,
      threshold: THRESHOLD_PERCENT,
      detail: codes(missed),
      note: baseline ? undefined : 'No baseline ingested - check skipped.',
    }),
  ];

  const notAssessed = [
    {
      name: '12. Critical path test',
      note: 'Requires deliberately extending a critical activity and confirming the completion date moves by the same amount. Run in P6.',
    },
    {
      name: '13. Critical path length index (CPLI)',
      note: baseline
        ? 'Computable once a contract completion date is set in project.yaml.'
        : 'Requires a baseline and the contract completion date.',
    },
    {
      name: '14. Baseline execution index (BEI)',
      note: baseline ? undefined : 'Requires a baseline programme.',
    },
  ];

  const applicable = checks.filter((c) => !c.note?.includes('not applicable') && !c.note?.includes('skipped'));
  const failed = applicable.filter((c) => !c.passed);

  return {
    project: programme.project.code,
    dataDate,
    activityCount: total,
    relationshipCount: programme.relationships.length,
    checks,
    notAssessed,
    passed: applicable.length - failed.length,
    failed: failed.length,
    failedNames: failed.map((c) => c.name),
    verdict:
      failed.length === 0
        ? 'Passes all applicable DCMA checks.'
        : `Fails ${failed.length} of ${applicable.length} applicable DCMA checks.`,
  };
}
