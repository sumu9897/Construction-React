/**
 * Turn raw XER tables into one normalized programme object.
 *
 * Everything downstream (exceptions, diff, health check, look-ahead) reads this
 * shape and never touches the XER again. Durations and float are converted from
 * P6's internal hours into working days using each activity's own calendar,
 * because an activity on a 10-hour calendar and one on an 8-hour calendar report
 * the same float in hours but very different float in days.
 */

import { parseP6Date, dayOf } from '../util/dates.js';

const DEFAULT_HOURS_PER_DAY = 8;

const RELATIONSHIP_TYPES = {
  PR_FS: 'FS',
  PR_SS: 'SS',
  PR_FF: 'FF',
  PR_SF: 'SF',
};

const ACTIVITY_TYPES = {
  TT_Task: 'task',
  TT_Rsrc: 'resource-dependent',
  TT_Mile: 'start-milestone',
  TT_FinMile: 'finish-milestone',
  TT_LOE: 'level-of-effort',
  TT_WBS: 'wbs-summary',
};

const STATUS = {
  TK_NotStart: 'not-started',
  TK_Active: 'in-progress',
  TK_Complete: 'complete',
};

/**
 * P6 constraint codes. Presence of a constraint matters for the DCMA health
 * check and for explaining why a date will not move, so keep the distinction
 * between soft (preferential) and hard (mandatory) constraints.
 */
const CONSTRAINTS = {
  CS_ALAP: { label: 'As Late As Possible', hard: false },
  CS_MEO: { label: 'Finish On', hard: true },
  CS_MEOA: { label: 'Finish On or After', hard: false },
  CS_MEOB: { label: 'Finish On or Before', hard: false },
  CS_MSO: { label: 'Start On', hard: true },
  CS_MSOA: { label: 'Start On or After', hard: false },
  CS_MSOB: { label: 'Start On or Before', hard: false },
  CS_MANDSTART: { label: 'Mandatory Start', hard: true },
  CS_MANDFIN: { label: 'Mandatory Finish', hard: true },
};

const num = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const isYes = (value) => value === 'Y';

function buildCalendars(tables) {
  const calendars = new Map();
  for (const row of tables.CALENDAR?.rows ?? []) {
    const hours = num(row.day_hr_cnt);
    calendars.set(row.clndr_id, {
      id: row.clndr_id,
      name: row.clndr_name ?? null,
      hoursPerDay: hours && hours > 0 ? hours : DEFAULT_HOURS_PER_DAY,
    });
  }
  return calendars;
}

function buildWbs(tables, projectId) {
  const rows = (tables.PROJWBS?.rows ?? []).filter(
    (row) => !projectId || row.proj_id === projectId,
  );

  const byId = new Map(
    rows.map((row) => [
      row.wbs_id,
      {
        id: row.wbs_id,
        code: row.wbs_short_name ?? null,
        name: row.wbs_name ?? null,
        parentId: row.parent_wbs_id || null,
        isProjectNode: isYes(row.proj_node_flag),
        path: null,
      },
    ]),
  );

  // Resolve each node's full path once, memoized, and guard against the
  // self-referential parent chains that corrupt exports occasionally contain.
  const resolve = (id, seen = new Set()) => {
    const node = byId.get(id);
    if (!node) return [];
    if (node.path) return node.path.split(' / ');
    if (seen.has(id)) return [node.name ?? id];
    seen.add(id);

    const parentPath = node.parentId ? resolve(node.parentId, seen) : [];
    const segments = node.isProjectNode ? parentPath : [...parentPath, node.name ?? node.code ?? id];
    node.path = segments.join(' / ');
    return segments;
  };

  for (const id of byId.keys()) resolve(id);
  return byId;
}

/**
 * P6 stores three different notions of "percent complete" and which one is
 * authoritative depends on the activity's own complete_pct_type. Reading the
 * wrong one is the single most common source of wrong progress reporting.
 */
function resolvePercentComplete(row, targetDurationHours, remainingDurationHours) {
  const type = row.complete_pct_type;

  if (type === 'CP_Phys') {
    return { value: num(row.phys_complete_pct) ?? 0, basis: 'physical' };
  }

  if (type === 'CP_Units') {
    const target = num(row.target_work_qty);
    const actual = num(row.act_work_qty);
    if (target && target > 0) {
      return { value: round1((actual ?? 0) / target * 100), basis: 'units' };
    }
  }

  // CP_Drtn, and the fallback for anything unrecognised.
  if (targetDurationHours && targetDurationHours > 0) {
    const remaining = remainingDurationHours ?? 0;
    const done = Math.max(0, Math.min(1, 1 - remaining / targetDurationHours));
    return { value: round1(done * 100), basis: 'duration' };
  }

  return { value: row.status_code === 'TK_Complete' ? 100 : 0, basis: 'status' };
}

const round1 = (n) => Math.round(n * 10) / 10;
const toDays = (hours, hoursPerDay) =>
  hours === null ? null : round1(hours / (hoursPerDay || DEFAULT_HOURS_PER_DAY));

function buildActivities(tables, calendars, wbsById, projectId) {
  const rows = (tables.TASK?.rows ?? []).filter((row) => !projectId || row.proj_id === projectId);

  return rows.map((row) => {
    const calendar = calendars.get(row.clndr_id);
    const hoursPerDay = calendar?.hoursPerDay ?? DEFAULT_HOURS_PER_DAY;

    const targetDurationHours = num(row.target_drtn_hr_cnt);
    const remainingDurationHours = num(row.remain_drtn_hr_cnt);
    const totalFloatHours = num(row.total_float_hr_cnt);
    const freeFloatHours = num(row.free_float_hr_cnt);

    const status = STATUS[row.status_code] ?? 'not-started';
    const percent = resolvePercentComplete(row, targetDurationHours, remainingDurationHours);
    const wbs = wbsById.get(row.wbs_id);

    const totalFloatDays = toDays(totalFloatHours, hoursPerDay);
    const constraint = CONSTRAINTS[row.cstr_type];

    return {
      id: row.task_id,
      code: row.task_code ?? null,
      name: row.task_name ?? null,
      wbsId: row.wbs_id ?? null,
      wbsPath: wbs?.path ?? null,
      type: ACTIVITY_TYPES[row.task_type] ?? 'task',
      status,

      // "plan" is the current schedule; "early/late" drive the float maths.
      planStart: parseP6Date(row.target_start_date),
      planFinish: parseP6Date(row.target_end_date),
      earlyStart: parseP6Date(row.early_start_date),
      earlyFinish: parseP6Date(row.early_end_date),
      lateStart: parseP6Date(row.late_start_date),
      lateFinish: parseP6Date(row.late_end_date),
      actualStart: parseP6Date(row.act_start_date),
      actualFinish: parseP6Date(row.act_end_date),

      durationDays: toDays(targetDurationHours, hoursPerDay),
      remainingDays: toDays(remainingDurationHours, hoursPerDay),
      percentComplete: percent.value,
      percentBasis: percent.basis,

      totalFloatDays,
      freeFloatDays: toDays(freeFloatHours, hoursPerDay),
      // P6's own longest-path flag is more meaningful on multi-calendar
      // projects than a naive float<=0 test, so prefer it when present.
      critical: isYes(row.driving_path_flag) || (totalFloatDays !== null && totalFloatDays <= 0),
      longestPath: isYes(row.driving_path_flag),

      constraintType: constraint?.label ?? null,
      constraintIsHard: constraint?.hard ?? false,
      constraintDate: parseP6Date(row.cstr_date),
      secondaryConstraintType: CONSTRAINTS[row.cstr_type2]?.label ?? null,
      secondaryConstraintDate: parseP6Date(row.cstr_date2),

      calendarId: row.clndr_id ?? null,
      calendarHoursPerDay: hoursPerDay,
    };
  });
}

function buildRelationships(tables, activityIds) {
  const relationships = [];
  for (const row of tables.TASKPRED?.rows ?? []) {
    // Cross-project relationships appear in the file but point at activities
    // outside this project; drop them so downstream logic never dangles.
    if (!activityIds.has(row.task_id) || !activityIds.has(row.pred_task_id)) continue;

    const lagHours = num(row.lag_hr_cnt);
    relationships.push({
      id: row.task_pred_id,
      predecessorId: row.pred_task_id,
      successorId: row.task_id,
      type: RELATIONSHIP_TYPES[row.pred_type] ?? 'FS',
      lagDays: toDays(lagHours ?? 0, DEFAULT_HOURS_PER_DAY),
    });
  }
  return relationships;
}

/** Cost and quantity loading, summed per activity. Feeds cashflow and S-curves. */
function buildCostLoading(tables, activityIds) {
  const byActivity = new Map();
  for (const row of tables.TASKRSRC?.rows ?? []) {
    if (!activityIds.has(row.task_id)) continue;
    const entry = byActivity.get(row.task_id) ?? { budgetCost: 0, actualCost: 0, remainingCost: 0 };
    entry.budgetCost += num(row.target_cost) ?? 0;
    entry.actualCost += (num(row.act_reg_cost) ?? 0) + (num(row.act_ot_cost) ?? 0);
    entry.remainingCost += num(row.remain_cost) ?? 0;
    byActivity.set(row.task_id, entry);
  }
  return byActivity;
}

/**
 * @param {{header: object, tables: object}} raw  output of parseXerText
 * @param {{projectCode?: string, sourceFile?: string}} [options]
 */
export function normalizeProgramme(raw, options = {}) {
  const { header, tables } = raw;

  const projectRows = tables.PROJECT?.rows ?? [];
  if (projectRows.length === 0) {
    throw new Error('XER contains no PROJECT record');
  }

  // An XER can hold several projects. Pick the requested one, else the first
  // that actually owns activities, so a file exported with linked projects
  // does not silently resolve to an empty shell project.
  const activityCountByProject = new Map();
  for (const row of tables.TASK?.rows ?? []) {
    activityCountByProject.set(row.proj_id, (activityCountByProject.get(row.proj_id) ?? 0) + 1);
  }

  const projectRow =
    (options.projectCode &&
      projectRows.find((row) => row.proj_short_name === options.projectCode)) ||
    projectRows.find((row) => (activityCountByProject.get(row.proj_id) ?? 0) > 0) ||
    projectRows[0];

  const projectId = projectRow.proj_id;
  const calendars = buildCalendars(tables);
  const wbsById = buildWbs(tables, projectId);
  const activities = buildActivities(tables, calendars, wbsById, projectId);
  const activityIds = new Set(activities.map((a) => a.id));
  const relationships = buildRelationships(tables, activityIds);
  const costLoading = buildCostLoading(tables, activityIds);

  for (const activity of activities) {
    const cost = costLoading.get(activity.id);
    if (cost) {
      activity.budgetCost = round1(cost.budgetCost);
      activity.actualCost = round1(cost.actualCost);
      activity.remainingCost = round1(cost.remainingCost);
    }
  }

  const dataDate = parseP6Date(projectRow.last_recalc_date);

  return assembleProgramme({
    source: {
      file: options.sourceFile ?? null,
      p6Version: header.version,
      exportedAt: parseP6Date(header.exportDate) ?? header.exportDate ?? null,
      exportedBy: header.userFullName ?? header.user ?? null,
      currency: header.currency ?? null,
    },
    project: {
      id: projectId,
      code: projectRow.proj_short_name ?? null,
      name: projectRow.proj_short_name ?? null,
      dataDate,
      dataDateDay: dayOf(dataDate),
      plannedStart: parseP6Date(projectRow.plan_start_date),
      plannedFinish: parseP6Date(projectRow.plan_end_date),
      mustFinishBy: parseP6Date(projectRow.scd_end_date),
    },
    calendars: Object.fromEntries(calendars),
    wbs: [...wbsById.values()],
    activities,
    relationships,
  });
}

/**
 * Final assembly shared by every parser (XER, MSPDI). Computes the stats block
 * from the activities so no parser can report a different notion of "critical"
 * or "forecast finish" than the others.
 */
export function assembleProgramme({ source, project, calendars, wbs, activities, relationships }) {
  const complete = activities.filter((a) => a.status === 'complete').length;
  const inProgress = activities.filter((a) => a.status === 'in-progress').length;

  return {
    source,
    project,
    calendars,
    wbs,
    activities,
    relationships,
    stats: {
      activityCount: activities.length,
      complete,
      inProgress,
      notStarted: activities.length - complete - inProgress,
      criticalCount: activities.filter((a) => a.critical && a.status !== 'complete').length,
      relationshipCount: relationships.length,
      // Forecast completion = the latest finish still in the programme. This is
      // what actually moves when the contractor slips, regardless of what the
      // contract completion date says.
      forecastFinish:
        activities
          .map((a) => a.actualFinish ?? a.earlyFinish ?? a.planFinish)
          .filter(Boolean)
          .sort()
          .at(-1) ?? null,
    },
  };
}
