/**
 * The pieces the report is assembled from.
 *
 * Each takes plain data and returns an HTML string. Kept dumb on purpose - every
 * decision about what a figure means lives in model.js, so these can never
 * accidentally invent a value.
 */

import { hasValue } from '../model.js';
import { formatHuman } from '../../util/dates.js';

export const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const section = (title, body, { count, index } = {}) => `
  <div class="section">
    <div class="eyebrow">${index ? `<span class="index">${esc(index)}</span>` : ''}${esc(title)}${count ? ` <span class="count">${esc(count)}</span>` : ''}</div>
    ${body}
  </div>`;

export const empty = (message) => `<div class="empty">${esc(message)}</div>`;

export const pill = (tone, label) => `<span class="pill ${tone}">${esc(label)}</span>`;

export const callout = (title, body) => `
  <div class="callout">
    <div class="title">${esc(title)}</div>
    <div>${body}</div>
  </div>`;

/**
 * Render a figure that may not exist.
 *
 * This is the single most important component in the report. A missing measurement
 * renders as an explicit, visible statement - never as 0, never silently omitted.
 * These numbers end up in payment applications.
 */
export function figure(value, { suffix = '', unmeasuredClass = 'unmeasured' } = {}) {
  if (hasValue(value)) return `${esc(value.value)}${esc(suffix)}`;
  const reason = value?.reason ? `<div class="unmeasured-note">${esc(value.reason)}</div>` : '';
  return `<span class="${unmeasuredClass}">Not measured</span>${reason}`;
}

/**
 * One column of the data strip. The lead cell is the completion date, because
 * that is the number every other number on the page exists to explain - it gets
 * more width and a larger figure, nothing else differs.
 */
export function stripCell({ label, value, raw, delta, deltaTone, sub, lead = false }) {
  return `
  <div class="cell${lead ? ' lead' : ''}">
    <div class="label">${esc(label)}</div>
    <div class="value">${raw ?? esc(value)}</div>
    ${delta ? `<div class="delta" style="color:${deltaTone}">${esc(delta)}</div>` : ''}
    ${sub ? `<div class="sub">${sub}</div>` : ''}
  </div>`;
}

/**
 * @param {Array<{key:string,label:string,align?:string,width?:string}>} columns
 * @param {Array<object>} rows  values already rendered to HTML strings
 */
export function table(columns, rows, { emptyMessage = 'None.' } = {}) {
  if (!rows || rows.length === 0) return empty(emptyMessage);

  const head = columns
    .map(
      (col) =>
        `<th class="${col.align === 'right' ? 'num' : ''}"${col.width ? ` style="width:${col.width}"` : ''}>${esc(col.label)}</th>`,
    )
    .join('');

  const body = rows
    .map((row) => {
      const cells = columns
        .map((col) => {
          const classes = [col.align === 'right' ? 'num' : '', col.strong ? 'strong' : ''].filter(Boolean);
          return `<td class="${classes.join(' ')}">${row[col.key] ?? ''}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/** Float phrased the way it is said in a site meeting, not as a bare number. */
export function floatCell(days, colours) {
  if (days === null || days === undefined) return '<span class="muted">—</span>';
  if (days < 0) return `<span style="color:${colours.red};font-weight:600">${days}d</span>`;
  if (days === 0) return `<span style="color:${colours.amber};font-weight:600">0d</span>`;
  if (days <= 5) return `<span style="color:${colours.amber}">${days}d</span>`;
  return `${days}d`;
}

/** A due date, coloured and worded by how close it is. */
export function dueCell(due, daysRemaining, colours) {
  if (!due) return '<span class="muted">No date set</span>';
  const when = formatHuman(due);
  if (daysRemaining === null) return esc(when);
  if (daysRemaining < 0) {
    return `<span style="color:${colours.red};font-weight:600">${esc(when)}</span><div class="tight" style="color:${colours.red}">${Math.abs(daysRemaining)}d overdue</div>`;
  }
  if (daysRemaining <= 7) {
    return `<span style="color:${colours.amber};font-weight:600">${esc(when)}</span><div class="tight muted">in ${daysRemaining}d</div>`;
  }
  return `${esc(when)}<div class="tight muted">in ${daysRemaining}d</div>`;
}
