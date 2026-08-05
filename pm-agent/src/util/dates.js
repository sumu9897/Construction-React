/**
 * Date helpers. Everything in the Ledger is stored as an ISO date string
 * (YYYY-MM-DD) or a full ISO timestamp, never as a JS Date, so that files
 * diff cleanly in git and never shift because of a timezone.
 */

const MS_PER_DAY = 86_400_000;

/**
 * P6 writes dates as "YYYY-MM-DD HH:MM" (and occasionally just "YYYY-MM-DD").
 * Returns an ISO string, or null for the empty values P6 uses for "not set".
 */
export function parseP6Date(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (trimmed === '' || trimmed === '0') return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(trimmed);
  if (!match) return null;

  const [, y, m, d, hh = '00', mm = '00'] = match;
  return `${y}-${m}-${d}T${hh}:${mm}:00`;
}

/** The calendar day part of an ISO timestamp, e.g. "2026-07-30". */
export function dayOf(iso) {
  return iso ? iso.slice(0, 10) : null;
}

/** Today as YYYY-MM-DD in the host's local timezone (site time, not UTC). */
export function today(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Whole calendar days from `from` to `to`. Negative when `to` is earlier. */
export function daysBetween(from, to) {
  if (!from || !to) return null;
  const a = Date.parse(`${dayOf(from)}T00:00:00Z`);
  const b = Date.parse(`${dayOf(to)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / MS_PER_DAY);
}

export function addDays(isoDay, days) {
  const base = Date.parse(`${dayOf(isoDay)}T00:00:00Z`);
  if (Number.isNaN(base)) return null;
  return new Date(base + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** "12 Aug 2026" - for report and Telegram prose, never for storage. */
export function formatHuman(iso) {
  const day = dayOf(iso);
  if (!day) return '-';

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [y, m, d] = day.split('-');

  // A register is a hand-editable file, so a value that is not a date can always
  // reach this. Show it verbatim rather than composing "NaN undefined friday" -
  // these strings print on documents that go to a client, and a visibly wrong
  // date invites a correction, where a mangled one invites a phone call.
  const parsed = [Number(d), Number(m), Number(y)];
  if (parsed.some(Number.isNaN) || !months[parsed[1] - 1]) return String(iso);

  return `${parsed[0]} ${months[parsed[1] - 1]} ${parsed[2]}`;
}
