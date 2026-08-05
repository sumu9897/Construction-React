/**
 * XER diff engine - "what actually changed in the programme".
 *
 * A revised programme is submitted as a Gantt PDF and looks superficially like
 * the last one. What is invisible in that PDF: logic quietly removed, lags
 * added, hard constraints dropped in, durations cut without any corresponding
 * progress, activities deleted. Those are the changes that move a completion
 * date, and they are the changes this finds.
 *
 * Works in both directions. As PMC or client-side it is how you interrogate a
 * contractor's monthly update. As contractor it is how you see what your own
 * planner changed before the Engineer does.
 */

import { daysBetween, dayOf } from '../util/dates.js';

/** Activity codes are stable across revisions; internal task_ids are not. */
const keyOf = (activity) => activity.code ?? activity.id;

const relationshipKey = (rel, activitiesById) => {
  const pred = activitiesById.get(rel.predecessorId);
  const succ = activitiesById.get(rel.successorId);
  if (!pred || !succ) return null;
  return `${keyOf(pred)}->${keyOf(succ)}`;
};

function indexProgramme(programme) {
  const byId = new Map(programme.activities.map((a) => [a.id, a]));
  const byKey = new Map(programme.activities.map((a) => [keyOf(a), a]));

  const relationships = new Map();
  for (const rel of programme.relationships) {
    const key = relationshipKey(rel, byId);
    if (key) relationships.set(key, rel);
  }

  return { byId, byKey, relationships };
}

const changed = (a, b) => (a ?? null) !== (b ?? null);

/**
 * Duration cut with no matching progress is the classic way a slipping
 * programme is made to look on time. Worth calling out explicitly.
 */
function isUnsupportedDurationCut(before, after) {
  if (before.durationDays === null || after.durationDays === null) return false;
  const cut = before.durationDays - after.durationDays;
  if (cut <= 0) return false;
  const progressed = (after.percentComplete ?? 0) - (before.percentComplete ?? 0);
  return cut >= 1 && progressed <= 0 && after.status !== 'complete';
}

export function diffProgrammes(previous, current, options = {}) {
  const materialShiftDays = options.materialShiftDays ?? 1;

  const before = indexProgramme(previous);
  const after = indexProgramme(current);

  const added = [];
  const removed = [];
  const dateChanges = [];
  const durationChanges = [];
  const floatChanges = [];
  const constraintChanges = [];
  const statusChanges = [];
  const criticalityChanges = [];

  for (const [key, activity] of after.byKey) {
    if (!before.byKey.has(key)) {
      added.push({
        code: key,
        name: activity.name,
        wbsPath: activity.wbsPath,
        planStart: activity.planStart,
        planFinish: activity.planFinish,
        durationDays: activity.durationDays,
        critical: activity.critical,
      });
    }
  }

  for (const [key, activity] of before.byKey) {
    if (!after.byKey.has(key)) {
      removed.push({
        code: key,
        name: activity.name,
        wbsPath: activity.wbsPath,
        planStart: activity.planStart,
        planFinish: activity.planFinish,
        // Removing an incomplete activity is materially different from
        // removing one that was already finished.
        wasComplete: activity.status === 'complete',
        wasCritical: activity.critical,
      });
    }
  }

  for (const [key, now] of after.byKey) {
    const was = before.byKey.get(key);
    if (!was) continue;

    const startShift = daysBetween(was.planStart, now.planStart);
    const finishShift = daysBetween(was.planFinish, now.planFinish);

    if (
      (startShift !== null && Math.abs(startShift) >= materialShiftDays) ||
      (finishShift !== null && Math.abs(finishShift) >= materialShiftDays)
    ) {
      dateChanges.push({
        code: key,
        name: now.name,
        wbsPath: now.wbsPath,
        startShiftDays: startShift,
        finishShiftDays: finishShift,
        from: { start: dayOf(was.planStart), finish: dayOf(was.planFinish) },
        to: { start: dayOf(now.planStart), finish: dayOf(now.planFinish) },
        critical: now.critical,
      });
    }

    if (changed(was.durationDays, now.durationDays)) {
      durationChanges.push({
        code: key,
        name: now.name,
        fromDays: was.durationDays,
        toDays: now.durationDays,
        deltaDays: (now.durationDays ?? 0) - (was.durationDays ?? 0),
        unsupported: isUnsupportedDurationCut(was, now),
        percentComplete: now.percentComplete,
        critical: now.critical,
      });
    }

    if (changed(was.totalFloatDays, now.totalFloatDays)) {
      const delta = (now.totalFloatDays ?? 0) - (was.totalFloatDays ?? 0);
      floatChanges.push({
        code: key,
        name: now.name,
        fromDays: was.totalFloatDays,
        toDays: now.totalFloatDays,
        deltaDays: delta,
        eroded: delta < 0,
        wentNegative: (was.totalFloatDays ?? 0) >= 0 && (now.totalFloatDays ?? 0) < 0,
      });
    }

    if (
      changed(was.constraintType, now.constraintType) ||
      changed(dayOf(was.constraintDate), dayOf(now.constraintDate))
    ) {
      constraintChanges.push({
        code: key,
        name: now.name,
        from: { type: was.constraintType, date: dayOf(was.constraintDate) },
        to: { type: now.constraintType, date: dayOf(now.constraintDate) },
        // A hard constraint added between revisions overrides logic and can
        // mask a real slip. Always worth a question.
        hardConstraintAdded: !was.constraintIsHard && now.constraintIsHard,
      });
    }

    if (changed(was.status, now.status) || changed(was.percentComplete, now.percentComplete)) {
      statusChanges.push({
        code: key,
        name: now.name,
        fromStatus: was.status,
        toStatus: now.status,
        fromPercent: was.percentComplete,
        toPercent: now.percentComplete,
        // Progress going backwards means either a reporting error or a rework
        // event nobody told you about.
        regressed: (now.percentComplete ?? 0) < (was.percentComplete ?? 0),
      });
    }

    if (was.critical !== now.critical) {
      criticalityChanges.push({
        code: key,
        name: now.name,
        becameCritical: now.critical,
        floatDays: now.totalFloatDays,
      });
    }
  }

  // Logic changes - the ones that hide best in a Gantt chart.
  const logicAdded = [];
  const logicRemoved = [];
  const logicChanged = [];

  for (const [key, rel] of after.relationships) {
    const was = before.relationships.get(key);
    if (!was) {
      logicAdded.push({ link: key, type: rel.type, lagDays: rel.lagDays });
      continue;
    }
    if (was.type !== rel.type || was.lagDays !== rel.lagDays) {
      logicChanged.push({
        link: key,
        from: { type: was.type, lagDays: was.lagDays },
        to: { type: rel.type, lagDays: rel.lagDays },
        lagIncreasedDays: (rel.lagDays ?? 0) - (was.lagDays ?? 0),
      });
    }
  }

  for (const [key, rel] of before.relationships) {
    if (!after.relationships.has(key)) {
      logicRemoved.push({ link: key, type: rel.type, lagDays: rel.lagDays });
    }
  }

  const completionShift = daysBetween(
    previous.stats.forecastFinish,
    current.stats.forecastFinish,
  );

  // The headline: what a reviewer should look at first.
  const redFlags = [];
  if (completionShift !== null && completionShift > 0) {
    redFlags.push(`Forecast completion moved out by ${completionShift} days.`);
  }
  if (removed.some((a) => !a.wasComplete)) {
    const n = removed.filter((a) => !a.wasComplete).length;
    redFlags.push(`${n} incomplete ${n === 1 ? 'activity was' : 'activities were'} deleted from the programme.`);
  }
  if (logicRemoved.length > 0) {
    redFlags.push(`${logicRemoved.length} logic ${logicRemoved.length === 1 ? 'link was' : 'links were'} removed.`);
  }
  const lagsAdded = logicChanged.filter((l) => l.lagIncreasedDays > 0).length;
  if (lagsAdded > 0) {
    redFlags.push(`${lagsAdded} relationship ${lagsAdded === 1 ? 'lag was' : 'lags were'} increased.`);
  }
  const unsupportedCuts = durationChanges.filter((d) => d.unsupported);
  if (unsupportedCuts.length > 0) {
    redFlags.push(
      `${unsupportedCuts.length} ${unsupportedCuts.length === 1 ? 'activity had its duration' : 'activities had durations'} cut with no corresponding progress.`,
    );
  }
  const hardConstraints = constraintChanges.filter((c) => c.hardConstraintAdded).length;
  if (hardConstraints > 0) {
    redFlags.push(`${hardConstraints} hard ${hardConstraints === 1 ? 'constraint was' : 'constraints were'} added.`);
  }
  const wentNegative = floatChanges.filter((f) => f.wentNegative).length;
  if (wentNegative > 0) {
    redFlags.push(`${wentNegative} ${wentNegative === 1 ? 'activity' : 'activities'} went into negative float.`);
  }
  if (statusChanges.some((s) => s.regressed)) {
    const n = statusChanges.filter((s) => s.regressed).length;
    redFlags.push(`${n} ${n === 1 ? 'activity shows' : 'activities show'} progress going backwards.`);
  }

  // The masking pattern: float has gone negative, so work has slipped, yet the
  // reported completion date has not moved. Something is holding it - almost
  // always a hard constraint or a deleted link. This combination is the single
  // most useful thing a reviewer can be told, so it goes last and reads loudest.
  if (wentNegative > 0 && (completionShift === null || completionShift <= 0)) {
    redFlags.push(
      'Float went negative but the completion date did not move — the slip is being absorbed by a constraint or missing logic rather than shown. Interrogate this before accepting the revision.',
    );
  }

  return {
    from: {
      dataDate: previous.project.dataDateDay,
      file: previous.source.file,
      forecastFinish: dayOf(previous.stats.forecastFinish),
      activityCount: previous.stats.activityCount,
    },
    to: {
      dataDate: current.project.dataDateDay,
      file: current.source.file,
      forecastFinish: dayOf(current.stats.forecastFinish),
      activityCount: current.stats.activityCount,
    },
    completionShiftDays: completionShift,
    redFlags,
    summary: {
      added: added.length,
      removed: removed.length,
      dateChanges: dateChanges.length,
      durationChanges: durationChanges.length,
      unsupportedDurationCuts: unsupportedCuts.length,
      floatChanges: floatChanges.length,
      floatWentNegative: wentNegative,
      constraintChanges: constraintChanges.length,
      hardConstraintsAdded: hardConstraints,
      logicAdded: logicAdded.length,
      logicRemoved: logicRemoved.length,
      logicChanged: logicChanged.length,
      statusChanges: statusChanges.length,
      criticalityChanges: criticalityChanges.length,
    },
    added,
    removed,
    dateChanges: dateChanges.sort(
      (a, b) => Math.abs(b.finishShiftDays ?? 0) - Math.abs(a.finishShiftDays ?? 0),
    ),
    durationChanges,
    floatChanges: floatChanges.sort((a, b) => (a.deltaDays ?? 0) - (b.deltaDays ?? 0)),
    constraintChanges,
    statusChanges,
    criticalityChanges,
    logic: { added: logicAdded, removed: logicRemoved, changed: logicChanged },
  };
}
