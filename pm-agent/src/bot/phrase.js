/**
 * Reading a register entry out of the way a site manager actually types.
 *
 *   "order concrete batch owner Jihad PMCC due by 1 aug"
 *   -> subject "order concrete batch", owner "Jihad PMCC", due 2026-08-01
 *
 * The pipe syntax still works and still wins where both are present - this only
 * catches what a thumb types at 19:00 when nobody remembers the punctuation.
 *
 * Deliberately deterministic. No model, no network, no guessing at intent: a
 * fixed set of keywords, and a date grammar that either matches or returns null.
 * Everything it extracts is echoed back to the author before it can reach a
 * chase letter, and anything it cannot read stays in the subject rather than
 * being silently dropped.
 */

import { today } from '../util/dates.js';

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const iso = (date) => date.toISOString().slice(0, 10);
const addDays = (date, n) => new Date(date.getTime() + n * 86_400_000);

/** Month index from a full name or any unambiguous prefix ("aug", "sept"). */
function monthIndex(word) {
  const w = word.toLowerCase().replace(/\./g, '');
  if (w.length < 3) return -1;
  const hits = MONTHS.filter((m) => m.startsWith(w));
  return hits.length === 1 ? MONTHS.indexOf(hits[0]) : -1;
}

/**
 * Parse a date phrase to ISO, or null.
 *
 * A bare day and month with no year resolves to the next such date that has not
 * already passed - "1 aug" typed on 30 Jul is this year, typed on 2 Aug is next.
 * Anything ambiguous returns null and is left in the subject; a wrong deadline
 * in a register drives a wrong chase letter.
 *
 * @param {string} text
 * @param {string} [asOf] ISO day to resolve relative phrases against
 * @returns {string|null} ISO day
 */
export function parseDatePhrase(text, asOf = today()) {
  const raw = String(text ?? '').trim().toLowerCase().replace(/^(by|on|before|the)\s+/, '');
  if (!raw) return null;

  const base = new Date(`${asOf}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return null;

  // ISO, the format the registers store.
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (isoMatch) return raw;

  if (raw === 'today') return iso(base);
  if (raw === 'tomorrow') return iso(addDays(base, 1));
  if (raw === 'asap' || raw === 'now' || raw === 'urgent') return iso(base);

  // "in 3 days", "in 2 weeks"
  const inMatch = /^in\s+(\d{1,3})\s*(day|days|week|weeks|month|months)$/.exec(raw);
  if (inMatch) {
    const n = Number(inMatch[1]);
    const unit = inMatch[2];
    if (unit.startsWith('day')) return iso(addDays(base, n));
    if (unit.startsWith('week')) return iso(addDays(base, n * 7));
    const m = new Date(base);
    m.setUTCMonth(m.getUTCMonth() + n);
    return iso(m);
  }

  if (/^end of (the )?week$|^eow$/.test(raw)) {
    // Friday of the current week, or today if it is already Friday or later.
    const delta = (5 - base.getUTCDay() + 7) % 7;
    return iso(addDays(base, delta));
  }
  if (/^end of (the )?month$|^eom$/.test(raw)) {
    const m = new Date(base);
    m.setUTCMonth(m.getUTCMonth() + 1, 0);
    return iso(m);
  }
  if (raw === 'next week') return iso(addDays(base, 7));
  if (raw === 'next month') {
    const m = new Date(base);
    m.setUTCMonth(m.getUTCMonth() + 1);
    return iso(m);
  }

  // "friday", "next friday" - the next one strictly ahead, so "friday" said on a
  // Friday means the coming Friday, not today.
  const dayMatch = /^(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/.exec(raw);
  if (dayMatch) {
    const target = WEEKDAYS.indexOf(dayMatch[2]);
    let delta = (target - base.getUTCDay() + 7) % 7;
    if (delta === 0) delta = 7;
    if (dayMatch[1]) delta += delta <= 6 ? 0 : 0; // "next friday" is still the coming one
    return iso(addDays(base, delta));
  }

  // "1 aug", "1 august 2026", "aug 1", "august 1st"
  const dmy = /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\.?(?:\s+(\d{4}))?$/.exec(raw);
  const mdy = /^([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?$/.exec(raw);
  const named = dmy
    ? { day: Number(dmy[1]), month: monthIndex(dmy[2]), year: dmy[3] }
    : mdy
      ? { day: Number(mdy[2]), month: monthIndex(mdy[1]), year: mdy[3] }
      : null;

  if (named && named.month >= 0 && named.day >= 1 && named.day <= 31) {
    const year = named.year ? Number(named.year) : base.getUTCFullYear();
    let candidate = new Date(Date.UTC(year, named.month, named.day));
    if (candidate.getUTCMonth() !== named.month) return null; // 31 Feb and friends
    // No year given and the date has passed - they mean next year.
    if (!named.year && candidate < base) {
      candidate = new Date(Date.UTC(year + 1, named.month, named.day));
    }
    return iso(candidate);
  }

  // "1/8", "01/08/2026" - day first, the convention everywhere this runs.
  const slash = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/.exec(raw);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]) - 1;
    if (month < 0 || month > 11 || day < 1 || day > 31) return null;
    const year = slash[3]
      ? Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3])
      : base.getUTCFullYear();
    let candidate = new Date(Date.UTC(year, month, day));
    if (candidate.getUTCMonth() !== month) return null;
    if (!slash[3] && candidate < base) candidate = new Date(Date.UTC(year + 1, month, day));
    return iso(candidate);
  }

  return null;
}

/**
 * The words that introduce a field, longest first so "assigned to" wins over "to".
 *
 * `field` names where the value goes. `dateOnly` marks a keyword that is only a
 * field at all when what follows it is a date - "by 1 aug" is a deadline, but
 * "by Jihad" is an owner, and "concrete delivered by crane" is neither.
 */
const KEYWORDS = [
  { words: ['assigned to', 'responsible', 'owner is', 'owner'], field: 'owner' },
  { words: ['due by', 'due on', 'due before', 'deadline', 'due'], field: 'due', forceDate: true },
  { words: ['mitigation', 'mitigated by', 'mitigate'], field: 'mitigation' },
  { words: ['impact'], field: 'impact' },
  { words: ['before', 'by'], field: 'due', dateOnly: true },
  { words: ['with', 'from'], field: 'owner', personOnly: true },
];

const ALL_WORDS = KEYWORDS.flatMap((k) => k.words).sort((a, b) => b.length - a.length);

/** Whether a phrase looks like a person or organisation rather than a date. */
const looksLikeParty = (value, asOf) => Boolean(value) && parseDatePhrase(value, asOf) === null;

/**
 * A value opening with a preposition or conjunction is the sentence continuing,
 * not a field: "agree impact **of the permit stoppage**" is the work itself.
 * This is what stops a keyword buried mid-subject from eating the line.
 */
const CONTINUES_SENTENCE = /^(of|on|in|at|to|and|or|that|which|who|when|if|was|is|are|has|have|will|would|should|being|been)\b/i;

/** A subject shorter than this is not a subject - the keyword was a false hit. */
const MIN_SUBJECT_WORDS = 2;
const wordCount = (text) => text.trim().split(/\s+/).filter(Boolean).length;

/**
 * Pull owner / due / impact / mitigation out of one free-text line.
 *
 * @param {string} text
 * @param {object} [options] {asOf}
 * @returns {{subject: string, fields: object}}
 */
export function parsePhrase(text, { asOf = today() } = {}) {
  const input = String(text ?? '').trim();
  if (!input) return { subject: '', fields: {} };

  // Locate every keyword occurrence, on word boundaries, outside the first word
  // (a line starting "owner" has no subject and is not what anyone meant).
  const hits = [];
  for (const word of ALL_WORDS) {
    const pattern = new RegExp(`(^|\\s)${word.replace(/ /g, '\\s+')}\\s*:?\\s+`, 'gi');
    let match;
    while ((match = pattern.exec(input)) !== null) {
      const start = match.index + match[1].length;
      if (start === 0) continue;
      hits.push({ start, end: match.index + match[0].length, word });
    }
  }

  // Earliest first; where two keywords start at the same place the longer one has
  // already been sorted ahead, so the first survives and overlaps are dropped.
  hits.sort((a, b) => a.start - b.start || b.word.length - a.word.length);
  const chosen = [];
  for (const hit of hits) {
    if (chosen.some((c) => hit.start < c.end && hit.end > c.start)) continue;
    chosen.push(hit);
  }
  chosen.sort((a, b) => a.start - b.start);

  const fields = {};
  const rejected = [];

  // Walk backwards: each keyword's value runs to the next accepted keyword, and a
  // keyword that turns out not to be one (e.g. "by crane") gives its span back to
  // the segment before it.
  let boundary = input.length;
  for (let i = chosen.length - 1; i >= 0; i--) {
    const hit = chosen[i];
    const spec = KEYWORDS.find((k) => k.words.includes(hit.word.toLowerCase()));
    const value = input.slice(hit.end, boundary).trim().replace(/[,;.]$/, '');

    if (!value) {
      rejected.push(hit);
      continue;
    }
    // Two ways a keyword turns out to be ordinary prose: what follows it reads as
    // a continuation, or accepting it would leave no subject worth the name.
    if (!spec.forceDate && CONTINUES_SENTENCE.test(value)) {
      rejected.push(hit);
      continue;
    }
    if (wordCount(input.slice(0, hit.start)) < MIN_SUBJECT_WORDS) {
      rejected.push(hit);
      continue;
    }
    if (spec.field === 'due' || spec.dateOnly) {
      const day = parseDatePhrase(value, asOf);
      if (!day) {
        // "due" with something unreadable after it is worth saying out loud; a
        // bare "by <not a date>" is just ordinary prose.
        if (spec.forceDate) fields.dueUnreadable = value;
        rejected.push(hit);
        continue;
      }
      if (!fields.due) fields.due = day;
    } else if (spec.personOnly && !looksLikeParty(value, asOf)) {
      rejected.push(hit);
      continue;
    } else if (!fields[spec.field]) {
      fields[spec.field] = value;
    }

    boundary = hit.start;
  }

  const subject = input.slice(0, boundary).trim().replace(/[,;.]$/, '');

  // Everything before the first accepted keyword is the subject. If that leaves
  // nothing, the line was all keyword and the safest reading is that none of it
  // was: keep the author's words intact.
  if (!subject) return { subject: input, fields: {} };

  return { subject, fields, rejected: rejected.length };
}
