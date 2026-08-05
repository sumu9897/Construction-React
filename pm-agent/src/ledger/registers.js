/**
 * Shared conventions for reading the YAML registers.
 *
 * Registers are hand-editable, so field names drift - one person writes `subject`,
 * another writes `description`, a third writes `title`. Rather than policing that,
 * every reader goes through these accessors. The alternative is each consumer
 * quietly disagreeing about what "open" means, which is how a chased item stops
 * being chased.
 */

import { dayOf, addDays } from '../util/dates.js';

/**
 * Statuses that mean "no longer needs chasing". Anything else - including a blank
 * status - is open, because an entry someone forgot to classify is exactly the one
 * that needs a nudge.
 */
export const CLOSED_STATUSES = new Set([
  'closed',
  'approved',
  'answered',
  'complete',
  'completed',
  'done',
  'resolved',
  'issued',
  'ordered',
  'delivered',
  'cancelled',
  'canceled',
  'superseded',
  'withdrawn',
]);

export const entriesOf = (register) => register?.entries ?? [];

export const isOpen = (entry) =>
  !CLOSED_STATUSES.has(String(entry?.status ?? 'open').toLowerCase().trim());

export const openEntries = (register) => entriesOf(register).filter(isOpen);

/** When the item was raised / submitted / logged. */
export const raisedOn = (entry) => dayOf(entry?.date ?? entry?.raised ?? entry?.submitted ?? null);

/** When it is due back. */
export const dueOn = (entry) => dayOf(entry?.dueDate ?? entry?.due ?? entry?.by ?? null);

export const subjectOf = (entry) =>
  entry?.subject ?? entry?.description ?? entry?.title ?? entry?.item ?? '-';

export const ownerOf = (entry) => entry?.owner ?? entry?.with ?? entry?.responsible ?? null;

/**
 * Lead time in days, however it was written. Weeks are the unit people actually
 * use for procurement, so both are accepted.
 */
export function leadTimeDays(entry) {
  if (typeof entry?.leadTimeDays === 'number') return entry.leadTimeDays;
  if (typeof entry?.leadTimeWeeks === 'number') return Math.round(entry.leadTimeWeeks * 7);
  return null;
}

/**
 * Work out when a procurement item has to be ordered.
 *
 * Need-on-site comes from the linked activity's planned start, so the order-by date
 * moves when the programme moves. A hand-written list of order dates goes stale the
 * first time the programme is revised, which is exactly when it matters.
 *
 * Shared by the alert rules and the weekly report so the two can never disagree.
 *
 * @param {object} entry            a procurement register entry
 * @param {Map} activityByCode      activity code -> normalized activity
 */
export function procurementDates(entry, activityByCode) {
  const lead = leadTimeDays(entry);
  const activity = entry?.activity ? activityByCode?.get(entry.activity) : null;

  // Linked to an activity that is no longer in the programme - usually because it
  // was deleted or renumbered between revisions.
  const orphaned = Boolean(entry?.activity) && !activity && !entry?.needOnSite;

  const needOnSite = dayOf(entry?.needOnSite) ?? dayOf(activity?.planStart) ?? null;
  const orderBy = needOnSite && lead !== null ? addDays(needOnSite, -lead) : null;

  return { leadDays: lead, needOnSite, orderBy, orphaned, activity: activity ?? null };
}

/**
 * Append an entry with the next sequential reference.
 *
 * References are never reused even after a deletion - a reused RFI number is a real
 * problem in a dispute.
 */
export function nextRef(register, prefix) {
  const next = register?.nextRef ?? entriesOf(register).length + 1;
  return `${prefix}-${String(next).padStart(3, '0')}`;
}
