/**
 * Build XER text from plain objects, so tests can express a scenario
 * ("the contractor deleted a link and cut a duration") instead of hand-editing
 * tab-delimited text.
 */

const TAB = '\t';

function table(name, fields, rows) {
  const lines = [`%T${TAB}${name}`, `%F${TAB}${fields.join(TAB)}`];
  for (const row of rows) {
    lines.push(`%R${TAB}${fields.map((f) => row[f] ?? '').join(TAB)}`);
  }
  return lines.join('\n');
}

const TASK_FIELDS = [
  'task_id', 'proj_id', 'wbs_id', 'clndr_id', 'task_code', 'task_name', 'task_type',
  'status_code', 'complete_pct_type', 'phys_complete_pct',
  'target_drtn_hr_cnt', 'remain_drtn_hr_cnt',
  'target_start_date', 'target_end_date',
  'early_start_date', 'early_end_date', 'late_start_date', 'late_end_date',
  'act_start_date', 'act_end_date',
  'total_float_hr_cnt', 'free_float_hr_cnt', 'driving_path_flag',
  'cstr_type', 'cstr_date',
];

/**
 * @param {object} spec
 * @param {string} spec.dataDate         YYYY-MM-DD
 * @param {Array}  spec.activities       partial task rows, in friendly units
 * @param {Array}  spec.relationships    [{pred, succ, type, lagDays}]
 */
export function makeXer(spec) {
  const {
    projectCode = 'TEST-01',
    dataDate = '2026-07-01',
    planStart = '2026-01-05',
    planFinish = '2026-12-18',
    hoursPerDay = 8,
    activities = [],
    relationships = [],
  } = spec;

  const header = [
    'ERMHDR', '19.12', dataDate, 'Project', 'admin', 'Test Harness',
    'dbxDatabaseNoName', 'Project Management', 'USD',
  ].join(TAB);

  const codeToId = new Map(activities.map((a, i) => [a.code, String(1000 + i)]));

  const taskRows = activities.map((a, i) => ({
    task_id: codeToId.get(a.code),
    proj_id: '1',
    wbs_id: a.wbsId ?? '10',
    clndr_id: '1',
    task_code: a.code,
    task_name: a.name ?? `Activity ${i}`,
    task_type: a.type ?? 'TT_Task',
    status_code: a.status ?? 'TK_NotStart',
    complete_pct_type: a.percentType ?? 'CP_Phys',
    phys_complete_pct: a.percentComplete ?? '0',
    target_drtn_hr_cnt: a.durationDays === undefined ? '' : String(a.durationDays * hoursPerDay),
    remain_drtn_hr_cnt: a.remainingDays === undefined ? '' : String(a.remainingDays * hoursPerDay),
    target_start_date: a.planStart ? `${a.planStart} 08:00` : '',
    target_end_date: a.planFinish ? `${a.planFinish} 17:00` : '',
    early_start_date: a.planStart ? `${a.planStart} 08:00` : '',
    early_end_date: a.planFinish ? `${a.planFinish} 17:00` : '',
    late_start_date: a.lateStart ? `${a.lateStart} 08:00` : '',
    late_end_date: a.lateFinish ? `${a.lateFinish} 17:00` : '',
    act_start_date: a.actualStart ? `${a.actualStart} 08:00` : '',
    act_end_date: a.actualFinish ? `${a.actualFinish} 17:00` : '',
    total_float_hr_cnt: a.totalFloatDays === undefined ? '' : String(a.totalFloatDays * hoursPerDay),
    free_float_hr_cnt: a.freeFloatDays === undefined ? '' : String(a.freeFloatDays * hoursPerDay),
    driving_path_flag: a.critical ? 'Y' : 'N',
    cstr_type: a.constraint ?? '',
    cstr_date: a.constraintDate ? `${a.constraintDate} 08:00` : '',
  }));

  const predRows = relationships.map((r, i) => ({
    task_pred_id: String(5000 + i),
    task_id: codeToId.get(r.succ),
    pred_task_id: codeToId.get(r.pred),
    proj_id: '1',
    pred_proj_id: '1',
    pred_type: r.type ? `PR_${r.type}` : 'PR_FS',
    lag_hr_cnt: String((r.lagDays ?? 0) * hoursPerDay),
  }));

  return [
    header,
    table('CALENDAR', ['clndr_id', 'clndr_name', 'day_hr_cnt'], [
      { clndr_id: '1', clndr_name: '6 Day Site Calendar', day_hr_cnt: String(hoursPerDay) },
    ]),
    table('PROJECT', ['proj_id', 'proj_short_name', 'plan_start_date', 'plan_end_date', 'last_recalc_date', 'scd_end_date'], [
      {
        proj_id: '1',
        proj_short_name: projectCode,
        plan_start_date: `${planStart} 08:00`,
        plan_end_date: `${planFinish} 17:00`,
        last_recalc_date: `${dataDate} 00:00`,
        scd_end_date: `${planFinish} 17:00`,
      },
    ]),
    table('PROJWBS', ['wbs_id', 'proj_id', 'wbs_short_name', 'wbs_name', 'parent_wbs_id', 'proj_node_flag'], [
      { wbs_id: '1', proj_id: '1', wbs_short_name: projectCode, wbs_name: projectCode, parent_wbs_id: '', proj_node_flag: 'Y' },
      { wbs_id: '10', proj_id: '1', wbs_short_name: 'STR', wbs_name: 'Structure', parent_wbs_id: '1', proj_node_flag: 'N' },
      { wbs_id: '20', proj_id: '1', wbs_short_name: 'MEP', wbs_name: 'MEP', parent_wbs_id: '1', proj_node_flag: 'N' },
    ]),
    table('TASK', TASK_FIELDS, taskRows),
    table('TASKPRED', ['task_pred_id', 'task_id', 'pred_task_id', 'proj_id', 'pred_proj_id', 'pred_type', 'lag_hr_cnt'], predRows),
    '%E',
    '',
  ].join('\n');
}

/**
 * A small but realistic programme: structure feeding MEP, one activity already
 * running late, one milestone, a critical chain.
 */
export const BASE_PROGRAMME = {
  projectCode: 'TEST-01',
  dataDate: '2026-07-01',
  activities: [
    {
      code: 'A-1000', name: 'Site mobilisation', status: 'TK_Complete',
      durationDays: 10, remainingDays: 0, percentComplete: '100',
      planStart: '2026-01-05', planFinish: '2026-01-16',
      actualStart: '2026-01-05', actualFinish: '2026-01-16',
      totalFloatDays: 0, critical: true,
    },
    {
      code: 'A-1100', name: 'Level 2 slab', status: 'TK_Complete',
      durationDays: 20, remainingDays: 0, percentComplete: '100',
      planStart: '2026-01-19', planFinish: '2026-02-13',
      actualStart: '2026-01-19', actualFinish: '2026-02-20',
      totalFloatDays: 0, critical: true,
    },
    {
      code: 'A-1240', name: 'Level 3 blockwork', status: 'TK_Active',
      durationDays: 25, remainingDays: 12, percentComplete: '52',
      planStart: '2026-06-01', planFinish: '2026-07-06',
      actualStart: '2026-06-03',
      totalFloatDays: 2, critical: true,
    },
    {
      code: 'A-1300', name: 'Level 3 MEP first fix', status: 'TK_NotStart', wbsId: '20',
      durationDays: 30, remainingDays: 30, percentComplete: '0',
      planStart: '2026-06-22', planFinish: '2026-07-31',
      totalFloatDays: 0, critical: true,
    },
    {
      code: 'A-1400', name: 'Facade procurement', status: 'TK_NotStart',
      durationDays: 40, remainingDays: 40, percentComplete: '0',
      planStart: '2026-07-06', planFinish: '2026-08-28',
      totalFloatDays: 60,
    },
    {
      code: 'M-9000', name: 'Practical completion', type: 'TT_FinMile',
      status: 'TK_NotStart', durationDays: 0, remainingDays: 0, percentComplete: '0',
      planStart: '2026-12-18', planFinish: '2026-12-18',
      totalFloatDays: 0, critical: true,
    },
  ],
  relationships: [
    { pred: 'A-1000', succ: 'A-1100' },
    { pred: 'A-1100', succ: 'A-1240' },
    { pred: 'A-1240', succ: 'A-1300', type: 'SS', lagDays: 5 },
    { pred: 'A-1300', succ: 'M-9000' },
    { pred: 'A-1400', succ: 'M-9000' },
  ],
};

/**
 * The same programme a month later, revised the way a contractor under pressure
 * revises one: a logic link removed, a lag stretched, a duration cut with no
 * progress behind it, a hard constraint dropped on the completion milestone,
 * and an incomplete activity quietly deleted.
 */
export const REVISED_PROGRAMME = {
  ...BASE_PROGRAMME,
  dataDate: '2026-08-01',
  activities: [
    BASE_PROGRAMME.activities[0],
    BASE_PROGRAMME.activities[1],
    {
      ...BASE_PROGRAMME.activities[2],
      status: 'TK_Active', percentComplete: '52', remainingDays: 6,
      durationDays: 19,
      planFinish: '2026-07-20',
      totalFloatDays: -3,
    },
    {
      ...BASE_PROGRAMME.activities[3],
      planStart: '2026-07-20', planFinish: '2026-08-20',
      totalFloatDays: -3,
    },
    {
      ...BASE_PROGRAMME.activities[5],
      constraint: 'CS_MANDFIN', constraintDate: '2026-12-18',
      totalFloatDays: 0,
    },
  ],
  relationships: [
    { pred: 'A-1000', succ: 'A-1100' },
    { pred: 'A-1100', succ: 'A-1240' },
    { pred: 'A-1240', succ: 'A-1300', type: 'SS', lagDays: 15 },
    { pred: 'A-1300', succ: 'M-9000' },
  ],
};
