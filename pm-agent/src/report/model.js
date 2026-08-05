/**
 * Build the weekly report data model from the Ledger.
 *
 * The rule that makes this document trustworthy: **never fabricate a measurement**.
 * It is enforced structurally rather than by discipline - every figure is a
 * `{ value, provenance }` pair, never a bare number, and the renderer prints
 * "Not measured this period" wherever provenance is `not-measured`. A missing
 * measurement is visible to the client, not silently rendered as zero.
 *
 * These figures end up in payment applications and claims. A plausible number is
 * worse than an admitted gap.
 */

import path from 'node:path';
import { projectPaths } from '../ledger/paths.js';
import { readYaml, readJson, listFiles, exists } from '../ledger/store.js';
import {
  loadLatestProgramme,
  loadLastTwoProgrammes,
  loadBaselineProgramme,
} from '../programme/ingest.js';
import { diffProgrammes } from '../analysis/diff.js';
import { computeExceptions } from '../analysis/exceptions.js';
import { entriesOf, isOpen, subjectOf, procurementDates } from '../ledger/registers.js';
import { today, dayOf, daysBetween, addDays, formatHuman } from '../util/dates.js';

// --- provenance ------------------------------------------------------------

/** Recorded in the Ledger by a human. The strongest source. */
export const measured = (value, asOf) => ({ value, provenance: 'measured', asOf });
/** As reported in the P6 update. Real, but it is the contractor's own claim. */
export const fromProgramme = (value, asOf) => ({ value, provenance: 'programme', asOf });
/** Computed from other values. `basis` states the rule so it can be argued with. */
export const derived = (value, basis) => ({ value, provenance: 'derived', basis });
/** Hand-entered, pending a proper commercial layer. */
export const manual = (value, asOf) => ({ value, provenance: 'manual', asOf });
/** Nothing available. Renders as "Not measured this period", never as 0. */
export const notMeasured = (reason) => ({ value: null, provenance: 'not-measured', reason });

export const hasValue = (figure) => figure && figure.value !== null && figure.value !== undefined;

const round1 = (n) => Math.round(n * 10) / 10;
const EXCLUDED_TYPES = new Set(['level-of-effort', 'wbs-summary']);

// --- progress --------------------------------------------------------------

/**
 * Weight activities by cost where the programme is cost-loaded, else by duration.
 * Weighting by activity count would let a hundred trivial snagging items outweigh
 * the frame, which is how progress reports end up saying 60% on a project that is
 * visibly a third built.
 */
function weightOf(activity, costLoaded) {
  if (costLoaded) return activity.budgetCost ?? 0;
  return activity.durationDays ?? 0;
}

function isCostLoaded(programme) {
  return programme.activities.some((a) => (a.budgetCost ?? 0) > 0);
}

/** Weighted percent complete across a whole programme. */
function weightedProgress(programme) {
  const costLoaded = isCostLoaded(programme);
  let weightTotal = 0;
  let earned = 0;

  for (const activity of programme.activities) {
    if (EXCLUDED_TYPES.has(activity.type)) continue;
    const weight = weightOf(activity, costLoaded);
    if (weight <= 0) continue;
    weightTotal += weight;
    earned += weight * ((activity.percentComplete ?? 0) / 100);
  }

  if (weightTotal === 0) return null;
  return { percent: round1((earned / weightTotal) * 100), basis: costLoaded ? 'cost' : 'duration' };
}

/**
 * What the baseline said should be complete by a given date - straight-line within
 * each activity, which is the standard simplification and is stated as such.
 */
function plannedProgressAt(programme, asOf) {
  const costLoaded = isCostLoaded(programme);
  let weightTotal = 0;
  let planned = 0;

  for (const activity of programme.activities) {
    if (EXCLUDED_TYPES.has(activity.type)) continue;
    const weight = weightOf(activity, costLoaded);
    if (weight <= 0) continue;
    weightTotal += weight;

    const start = dayOf(activity.planStart ?? activity.earlyStart);
    const finish = dayOf(activity.planFinish ?? activity.earlyFinish);
    if (!start || !finish) continue;

    const span = daysBetween(start, finish) || 1;
    const elapsed = daysBetween(start, asOf);
    if (elapsed === null) continue;

    const fraction = Math.max(0, Math.min(1, span <= 0 ? (elapsed >= 0 ? 1 : 0) : elapsed / span));
    planned += weight * fraction;
  }

  if (weightTotal === 0) return null;
  return round1((planned / weightTotal) * 100);
}

/**
 * The actual progress curve, one point per ingested P6 update.
 *
 * This is why every export is archived rather than overwritten: the archive *is*
 * the S-curve. It gets richer every week at no extra effort.
 */
async function actualSeries(projectCode) {
  const paths = projectPaths(projectCode);
  const files = await listFiles(paths.parsed, '.json');
  const points = [];

  for (const file of files) {
    const programme = await readJson(file);
    const progress = weightedProgress(programme);
    if (!progress || !programme.project.dataDateDay) continue;
    points.push({ date: programme.project.dataDateDay, percent: progress.percent });
  }

  return points;
}

/** Monthly planned/forecast curve across the programme span. */
function plannedSeries(programme) {
  const start = dayOf(programme.project.plannedStart);
  const finishCandidates = [
    dayOf(programme.stats.forecastFinish),
    dayOf(programme.project.plannedFinish),
  ].filter(Boolean);
  const finish = finishCandidates.sort().at(-1);

  if (!start || !finish) return [];

  const span = daysBetween(start, finish);
  if (span === null || span <= 0) return [];

  // ~24 samples across the span - enough for a smooth curve at print size,
  // few enough to keep the SVG small.
  const steps = Math.min(24, Math.max(6, Math.round(span / 30)));
  const points = [];

  for (let i = 0; i <= steps; i++) {
    const date = addDays(start, Math.round((span * i) / steps));
    const percent = plannedProgressAt(programme, date);
    if (percent === null) continue;
    points.push({ date, percent });
  }

  return points;
}

// --- status ----------------------------------------------------------------

/**
 * RAG status, computed from a stated rule rather than a feeling. The rule is
 * carried in `basis` so a client can argue with the logic instead of the colour.
 */
function computeStatus({ completionShiftDays, negativeFloatCount, overdueDecisions }) {
  if (negativeFloatCount > 0 || (completionShiftDays ?? 0) > 0) {
    const reasons = [];
    if ((completionShiftDays ?? 0) > 0) reasons.push(`completion moved out ${completionShiftDays}d`);
    if (negativeFloatCount > 0) reasons.push(`${negativeFloatCount} activities in negative float`);
    return { rag: 'red', label: 'Behind', basis: reasons.join('; ') };
  }

  if (overdueDecisions > 0) {
    return {
      rag: 'amber',
      label: 'At risk',
      basis: `${overdueDecisions} decision${overdueDecisions === 1 ? '' : 's'} overdue`,
    };
  }

  return { rag: 'green', label: 'On track', basis: 'No completion movement and no negative float' };
}

// --- registers -------------------------------------------------------------

// Register conventions are shared with the alert rules so the two can never
// disagree about what "open" means.

/**
 * Turnaround against the *contractual* response period. Where the other side is
 * late, that is the contractor's evidence for late information - so it is
 * reported factually, with dates, not as a complaint.
 */
function registerSummary(register, { asOf, responseDays, label }) {
  const entries = entriesOf(register);
  const open = entries.filter(isOpen);

  const overdue = responseDays
    ? open.filter((entry) => {
        const raised = dayOf(entry.date ?? entry.raised ?? entry.submitted);
        if (!raised) return false;
        return (daysBetween(raised, asOf) ?? 0) > responseDays;
      })
    : [];

  const oldest = open
    .map((entry) => dayOf(entry.date ?? entry.raised ?? entry.submitted))
    .filter(Boolean)
    .sort()[0];

  return {
    label,
    total: entries.length,
    open: open.length,
    overdue: overdue.length,
    responseDays: responseDays ?? null,
    oldestOpenDays: oldest ? daysBetween(oldest, asOf) : null,
    overdueEntries: overdue.slice(0, 5).map((entry) => ({
      ref: entry.ref,
      subject: entry.subject ?? entry.description ?? entry.title ?? '-',
      owner: entry.owner ?? entry.with ?? null,
      raised: dayOf(entry.date ?? entry.raised ?? entry.submitted),
      daysOpen: daysBetween(dayOf(entry.date ?? entry.raised ?? entry.submitted), asOf),
    })),
  };
}

// --- look-ahead ------------------------------------------------------------

/**
 * Mark each upcoming activity Ready or Blocked, naming the blocker.
 *
 * A look-ahead that just restates the programme prevents nothing. Naming what is
 * stopping each activity is what converts it into an action list.
 *
 * An activity is only marked Ready when the registers were actually checked. Where
 * a register is empty we say readiness is unverified rather than asserting Ready -
 * a false Ready gets labour planned around it.
 */
function buildLookahead(exceptions, registers, { asOf }) {
  const blockersFor = (code) => {
    const found = [];

    for (const [key, register] of Object.entries(registers)) {
      for (const entry of entriesOf(register)) {
        if (!isOpen(entry)) continue;
        if (entry.activity !== code) continue;
        found.push({
          register: key,
          ref: entry.ref,
          detail: entry.subject ?? entry.description ?? entry.title ?? key,
          owner: entry.owner ?? entry.with ?? null,
          since: dayOf(entry.date ?? entry.raised ?? entry.submitted),
          daysOpen: daysBetween(dayOf(entry.date ?? entry.raised ?? entry.submitted), asOf),
        });
      }
    }

    return found;
  };

  const anyRegisterPopulated = Object.values(registers).some((r) => entriesOf(r).length > 0);

  const items = exceptions.all.map((exception) => {
    const blockers = blockersFor(exception.code);
    return {
      code: exception.code,
      name: exception.name,
      wbsPath: exception.wbsPath,
      planStart: dayOf(exception.planStart),
      planFinish: dayOf(exception.planFinish),
      floatDays: exception.totalFloatDays,
      critical: exception.critical,
      state: blockers.length > 0 ? 'blocked' : anyRegisterPopulated ? 'ready' : 'unverified',
      blockers,
    };
  });

  // Float drives priority, not start date. A blocked activity with 2 days float
  // outranks one starting sooner with 30.
  items.sort((a, b) => (a.floatDays ?? 999) - (b.floatDays ?? 999));

  return {
    items,
    ready: items.filter((i) => i.state === 'ready').length,
    blocked: items.filter((i) => i.state === 'blocked').length,
    unverified: items.filter((i) => i.state === 'unverified').length,
    registersChecked: anyRegisterPopulated,
  };
}

// --- the model -------------------------------------------------------------

/**
 * @param {string} projectCode
 * @param {{asOf?: string, reportNo?: number, lookaheadDays?: number}} options
 */
export async function buildWeeklyModel(projectCode, options = {}) {
  const asOf = options.asOf ?? today();
  const paths = projectPaths(projectCode);
  const warnings = [];

  const config = (await readYaml(paths.config)) ?? {};
  const latest = await loadLatestProgramme(projectCode);

  if (!latest) {
    throw new Error(
      `No parsed programme for ${projectCode}. Run: pm ingest ${projectCode} <file.xer>`,
    );
  }

  const programme = latest.programme;
  const baseline = await loadBaselineProgramme(projectCode);
  const pair = await loadLastTwoProgrammes(projectCode);

  const programmeAgeDays = daysBetween(programme.project.dataDateDay, asOf);
  if (programmeAgeDays !== null && programmeAgeDays > 10) {
    warnings.push(
      `Programme data date is ${programmeAgeDays} days old (${programme.project.dataDateDay}). Every date in this report is computed from it.`,
    );
  }
  if (!baseline) {
    warnings.push('No baseline ingested - planned progress and variance cannot be stated.');
  }

  // --- what moved this week
  const diff = pair ? diffProgrammes(pair.previous.programme, pair.current.programme) : null;
  const completionShiftDays = diff?.completionShiftDays ?? null;

  const movements = [];
  if (diff) {
    if (completionShiftDays && completionShiftDays !== 0) {
      movements.push({
        emphasis: true,
        text: `Forecast completion moved ${Math.abs(completionShiftDays)} days ${completionShiftDays > 0 ? 'later' : 'earlier'}, from ${formatHuman(diff.from.forecastFinish)} to ${formatHuman(diff.to.forecastFinish)}.`,
      });
    } else {
      movements.push({ text: `Forecast completion unchanged at ${formatHuman(diff.to.forecastFinish)}.` });
    }
    // The completion-shift red flag restates the emphasis line above verbatim in
    // different words; every other flag carries new information.
    for (const flag of diff.redFlags.filter((f) => !f.startsWith('Forecast completion moved'))) {
      movements.push({ text: flag, flag: true });
    }

    const advanced = diff.statusChanges.filter((s) => s.toStatus === 'complete').length;
    if (advanced > 0) {
      movements.push({ text: `${advanced} ${advanced === 1 ? 'activity' : 'activities'} completed since the last update.` });
    }
  } else {
    movements.push({
      text: 'Only one programme update has been ingested, so no week-on-week comparison is possible yet.',
    });
  }

  // --- progress
  const actualProgress = weightedProgress(programme);
  const plannedNow = baseline ? plannedProgressAt(baseline.programme, asOf) : null;

  const progress = {
    actual: actualProgress
      ? fromProgramme(actualProgress.percent, programme.project.dataDateDay)
      : notMeasured('No activity durations or costs to weight progress against'),
    planned:
      plannedNow === null
        ? notMeasured('No baseline programme ingested')
        : derived(plannedNow, `Straight-line within each activity, weighted by ${actualProgress?.basis ?? 'duration'}`),
    weightBasis: actualProgress?.basis ?? null,
  };

  progress.variance =
    hasValue(progress.actual) && hasValue(progress.planned)
      ? derived(round1(progress.actual.value - progress.planned.value), 'Actual less planned')
      : notMeasured('Requires both a baseline and a current programme');

  // --- S-curve
  const sCurve = {
    planned: baseline ? plannedSeries(baseline.programme) : [],
    forecast: plannedSeries(programme),
    actual: await actualSeries(projectCode),
    emptyReason: baseline ? null : 'No baseline ingested — planned curve cannot be drawn',
  };

  // --- registers and decisions
  const registers = {
    rfi: await readYaml(paths.rfi),
    submittals: await readYaml(paths.submittals),
    ncr: await readYaml(paths.ncr),
    vo: await readYaml(paths.vo),
    procurement: await readYaml(paths.procurement),
  };

  const decisionsRegister = await readYaml(paths.decisions);
  const openDecisions = entriesOf(decisionsRegister)
    .filter(isOpen)
    .map((entry) => {
      const due = dayOf(entry.dueDate ?? entry.due ?? entry.by);
      return {
        ref: entry.ref,
        subject: entry.subject ?? entry.description ?? entry.title ?? '-',
        owner: entry.owner ?? entry.with ?? 'Not assigned',
        due,
        daysRemaining: due ? daysBetween(asOf, due) : null,
        overdue: due ? (daysBetween(due, asOf) ?? 0) > 0 : false,
        // The consequence is what makes a client act. If it is not recorded, say
        // so rather than inventing one.
        consequence: entry.consequence ?? null,
        activity: entry.activity ?? null,
      };
    })
    .sort((a, b) => (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999));

  const overdueDecisions = openDecisions.filter((d) => d.overdue).length;

  // --- risks
  const riskRegister = await readYaml(paths.risk);
  const risks = entriesOf(riskRegister)
    .filter(isOpen)
    .map((entry) => ({
      ref: entry.ref,
      subject: entry.subject ?? entry.description ?? entry.title ?? '-',
      owner: entry.owner ?? 'Not assigned',
      impact: entry.impact ?? null,
      likelihood: entry.likelihood ?? entry.probability ?? null,
      mitigation: entry.mitigation ?? null,
      score: Number(entry.score ?? 0),
    }))
    .sort((a, b) => b.score - a.score);

  // --- critical path
  const criticalPath = programme.activities
    .filter((a) => a.status !== 'complete' && !EXCLUDED_TYPES.has(a.type))
    .filter((a) => a.critical)
    .sort((a, b) => (a.totalFloatDays ?? 0) - (b.totalFloatDays ?? 0))
    .slice(0, 5)
    .map((a) => ({
      code: a.code,
      name: a.name,
      wbsPath: a.wbsPath,
      floatDays: a.totalFloatDays,
      planFinish: dayOf(a.planFinish),
      percentComplete: a.percentComplete,
      status: a.status,
    }));

  const negativeFloatCount = programme.activities.filter(
    (a) => a.status !== 'complete' && (a.totalFloatDays ?? 0) < 0,
  ).length;

  // --- look-ahead
  const exceptions = computeExceptions(programme, {
    asOf,
    config: { ...(config.chase ?? {}), lookaheadDays: options.lookaheadDays ?? 21 },
    progress: await readYaml(paths.progress),
    limit: 40,
  });
  const lookahead = buildLookahead(exceptions, registers, { asOf });

  // --- photos taken this period
  const photoIndex = await readYaml(path.join(paths.photos, 'index.yaml'));
  const weekStart = addDays(asOf, -6);
  const photos = [];
  for (const entry of photoIndex?.entries ?? []) {
    if (!entry.date || entry.date < weekStart || entry.date > asOf) continue;
    const file = path.join(paths.root, entry.file);
    if (!(await exists(file))) continue;
    photos.push({ ...entry, absolutePath: file });
  }

  // --- delay events this period
  const eventsRegister = await readYaml(paths.events);
  const events = entriesOf(eventsRegister)
    .filter((entry) => entry.date >= weekStart && entry.date <= asOf)
    .map((entry) => ({
      ref: entry.ref,
      date: entry.date,
      activity: entry.activity,
      description: entry.description,
      // Rendered exactly as recorded. `unclassified` stays `unclassified` and is
      // never upgraded into a claim by this report.
      responsibility: entry.responsibility ?? 'unclassified',
      noticeDeadline: entry.noticeDeadline ?? null,
      noticeIssued: Boolean(entry.noticeIssued),
    }));

  // --- commercial
  const cashflow = await readYaml(paths.cashflow);
  const voEntries = entriesOf(registers.vo);
  const commercial = {
    available: Boolean(cashflow) || voEntries.length > 0,
    cashflow: cashflow
      ? manual(cashflow, cashflow.updatedAt ?? null)
      : notMeasured('No cashflow data recorded — pm-agent has no valuation layer yet'),
    variations: {
      total: voEntries.length,
      open: voEntries.filter(isOpen).length,
      // Only sum where every entry carries a value, otherwise the total silently
      // understates and someone budgets against it.
      value: voEntries.every((entry) => typeof entry.value === 'number')
        ? manual(voEntries.reduce((sum, entry) => sum + entry.value, 0), asOf)
        : notMeasured('Not every variation is priced'),
    },
  };

  // --- report number
  const reportNo = options.reportNo ?? (await nextReportNumber(projectCode));

  const registerSummaries = {
    rfi: registerSummary(registers.rfi, {
      asOf,
      responseDays: config.contract?.rfiResponseDays,
      label: 'RFIs',
    }),
    submittals: registerSummary(registers.submittals, {
      asOf,
      responseDays: config.contract?.submittalResponseDays,
      label: 'Submittals',
    }),
    ncr: registerSummary(registers.ncr, { asOf, responseDays: null, label: 'NCRs' }),
    vo: registerSummary(registers.vo, { asOf, responseDays: null, label: 'Variations' }),
  };

  // A table of four zeroes tells the client nothing. Attach the appendix only
  // when at least one register has something in it.
  const anyRegisterEntries = Object.values(registerSummaries).some((r) => r.total > 0);

  // Procurement, with order-by dates derived from the live programme. Late
  // material is the most common real cause of delay and is almost entirely
  // preventable, so it earns a place in the client report.
  const activityByCode = new Map(programme.activities.map((a) => [a.code ?? a.id, a]));
  const procurementItems = entriesOf(registers.procurement)
    .filter(isOpen)
    .map((entry) => {
      const derived = procurementDates(entry, activityByCode);
      return {
        ref: entry.ref,
        item: subjectOf(entry),
        supplier: entry.supplier ?? null,
        activity: entry.activity ?? null,
        leadDays: derived.leadDays,
        needOnSite: derived.needOnSite,
        orderBy: derived.orderBy,
        orphaned: derived.orphaned,
        daysToOrder: derived.orderBy ? daysBetween(asOf, derived.orderBy) : null,
      };
    })
    .sort((a, b) => (a.daysToOrder ?? 9999) - (b.daysToOrder ?? 9999));

  const status = computeStatus({ completionShiftDays, negativeFloatCount, overdueDecisions });

  // The contract completion date is a contract fact, not a programme fact. P6
  // carries it as must-finish-by when the scheduler set one; MS Project exports
  // have no equivalent field, so the ledger's contract record is the fallback -
  // and the authoritative one, since it is what was signed.
  const contractDate = dayOf(programme.project.mustFinishBy ?? config.contract?.completionDate ?? null);

  return {
    meta: {
      code: projectCode,
      name: config.name ?? projectCode,
      role: config.role ?? null,
      contractForm: config.contract?.form ?? null,
      // The terms the report was measured against, so the document can state its
      // own basis rather than leaving the client to assume one.
      contract: config.contract ?? {},
      reportNo,
      weekEnding: asOf,
      weekStart,
      issuedAt: today(),
      dataDate: programme.project.dataDateDay,
      programmeAgeDays,
    },
    warnings,
    status,
    kpis: {
      completion: {
        date: dayOf(programme.stats.forecastFinish),
        contractDate,
        movementDays: completionShiftDays,
        varianceDays:
          contractDate && programme.stats.forecastFinish
            ? daysBetween(contractDate, programme.stats.forecastFinish)
            : null,
      },
      progress,
      decisions: { open: openDecisions.length, overdue: overdueDecisions },
      criticalCount: programme.stats.criticalCount,
      negativeFloatCount,
    },
    movements,
    sCurve,
    criticalPath,
    risks,
    decisions: openDecisions,
    appendices: {
      lookahead: lookahead.items.length > 0 ? lookahead : null,
      photos: photos.length > 0 ? photos : null,
      registers: anyRegisterEntries ? registerSummaries : null,
      procurement: procurementItems.length > 0 ? procurementItems : null,
      commercial: commercial.available ? commercial : null,
      events: events.length > 0 ? events : null,
    },
  };
}

/** Weekly reports are numbered sequentially; count what has already been issued. */
async function nextReportNumber(projectCode) {
  const paths = projectPaths(projectCode);
  const files = await listFiles(paths.reports, '.pdf');
  const weekly = files.filter((file) => path.basename(file).includes('weekly'));
  return weekly.length + 1;
}

export const _internals = {
  weightedProgress,
  plannedProgressAt,
  computeStatus,
  buildLookahead,
  registerSummary,
};
