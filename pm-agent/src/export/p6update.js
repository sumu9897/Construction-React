/**
 * Produce a P6-importable progress update.
 *
 * The agent never rewrites the XER. It writes a spreadsheet of the fields you
 * confirmed, which you import through P6's Excel import wizard and review
 * before saving. P6 stays the system of record for the schedule; automated
 * write-back would be fragile and would destroy the reviewability that makes a
 * programme defensible in a claim.
 *
 * Column headers match P6's default Excel import template exactly - rename them
 * and the wizard will not map the fields.
 */

import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { ensureDir } from '../ledger/store.js';
import { projectPaths } from '../ledger/paths.js';
import { dayOf } from '../util/dates.js';

const COLUMNS = [
  ['task_code', 'Activity ID'],
  ['task_name', 'Activity Name'],
  ['act_start_date', 'Actual Start'],
  ['act_end_date', 'Actual Finish'],
  ['phys_complete_pct', 'Physical % Complete'],
  ['remain_drtn_hr_cnt', 'Remaining Duration'],
];

/** P6's Excel import expects dates as DD-MMM-YY. */
function p6Date(iso) {
  const day = dayOf(iso);
  if (!day) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [y, m, d] = day.split('-');
  return `${d}-${months[Number(m) - 1]}-${y.slice(2)}`;
}

const escapeCsv = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * @param {Array<object>} updates  entries from the chase session
 * @param {object} options         { hoursPerDay } for remaining-duration conversion
 */
export function buildP6UpdateCsv(updates, options = {}) {
  const hoursPerDay = options.hoursPerDay ?? 8;

  const rows = updates.map((update) => ({
    task_code: update.code,
    task_name: update.name ?? '',
    act_start_date: p6Date(update.actualStart),
    act_end_date: p6Date(update.actualFinish),
    phys_complete_pct: update.percentComplete ?? '',
    // P6 stores remaining duration in hours on import.
    remain_drtn_hr_cnt:
      update.remainingDays === null || update.remainingDays === undefined
        ? ''
        : Math.round(update.remainingDays * hoursPerDay),
  }));

  const header = COLUMNS.map(([, label]) => escapeCsv(label)).join(',');
  const body = rows
    .map((row) => COLUMNS.map(([key]) => escapeCsv(row[key])).join(','))
    .join('\n');

  return `${header}\n${body}\n`;
}

export async function writeP6Update(projectCode, updates, { asOf, hoursPerDay } = {}) {
  if (updates.length === 0) return null;

  const paths = projectPaths(projectCode);
  await ensureDir(paths.p6updates);

  const csv = buildP6UpdateCsv(updates, { hoursPerDay });
  const file = path.join(paths.p6updates, `${asOf}-progress-update.csv`);
  await writeFile(file, csv, 'utf8');

  return { file, rowCount: updates.length };
}
