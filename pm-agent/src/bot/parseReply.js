/**
 * Turn a natural site reply into a structured progress update.
 *
 * You answer the way you would answer a foreman - "started tuesday, about 30%,
 * block delivery came up short" - not by filling in a form. This extracts what
 * it confidently can and reports what it could not, so the agent can ask one
 * targeted follow-up instead of rejecting the answer.
 *
 * Anything ambiguous is left null rather than guessed. A wrong actual start
 * date propagates into a payment application and an EOT claim, so silence is
 * always safer than a confident guess.
 */

import { addDays, daysBetween, dayOf } from '../util/dates.js';

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** Sunday-based calendar week number, used to disambiguate "next <weekday>". */
const weekIndex = (day) => Math.floor((Date.parse(`${day}T00:00:00Z`) / 86_400_000 + 4) / 7);
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * Delay cues, grouped by who is likely responsible. The grouping is a prompt
 * for the follow-up question, never a conclusion - entitlement is a contractual
 * judgement and the agent must not decide it on a keyword.
 */
const DELAY_CUES = [
  // "waiting for approval", but also "waiting for the consultant to approve the
  // shop drawings" - the object of the wait is often several words away.
  {
    pattern: /\b(awaiting|waiting (?:on|for)|pending|chasing)\b[^.!?]{0,40}?\b(approv|sign[- ]?off|instruct|decision|drawing|ifc|response|comment|information|answer|release)/i,
    hint: 'employer-or-consultant',
  },
  { pattern: /\bno\s+(approval|sign[- ]?off|instruction|decision|drawing|ifc|response|information)/i, hint: 'employer-or-consultant' },
  { pattern: /\b(rfi|submittal|shop drawing)s?\b[^.!?]{0,30}\b(not|pending|late|unanswered|outstanding|approved)/i, hint: 'employer-or-consultant' },
  { pattern: /\b(no access|access (not|denied|blocked)|possession)/i, hint: 'employer-or-consultant' },
  { pattern: /\b(variation|change order|additional works|extra works|instructed)/i, hint: 'employer-or-consultant' },
  { pattern: /\b(rain|weather|storm|wind|flood|sandstorm|heat)/i, hint: 'neutral' },
  { pattern: /\b(short|shortage|not delivered|late delivery|no (material|block|steel|concrete|rebar)|supplier)/i, hint: 'contractor-or-supplier' },
  { pattern: /\b(manpower|labour|labor|crew|no (men|workers)|absent|shortage of)/i, hint: 'contractor-or-supplier' },
  { pattern: /\b(breakdown|plant|crane|equipment|pump)\s*(down|broken|failed)?/i, hint: 'contractor-or-supplier' },
  { pattern: /\b(rework|defect|ncr|rejected|failed (test|inspection))/i, hint: 'contractor-or-supplier' },
  { pattern: /\b(held up|blocked|stopped|suspended|delayed|on hold)\b/i, hint: 'unclear' },
  // "lost time", "lost two days", "losing about half a week".
  { pattern: /\b(lost|losing)\b[^.!?]{0,15}?\b(time|days?|hours?|weeks?)\b/i, hint: 'unclear' },
];

const NEGATIVE = /\b(not started|hasn'?t started|no,? not|didn'?t start|nothing|not yet|no start)\b/i;
const COMPLETE = /\b(complete|completed|finished|done|closed out|100\s*%)\b/i;
const STARTED = /\b(started|commenced|began|begun|kicked off|underway|in progress|ongoing|running)\b/i;

/**
 * Resolve a relative or partial date against the session's as-of day.
 * Only returns dates in the recent past or near future - "monday" on a Friday
 * means last Monday when talking about an actual start, and a date months away
 * is far more likely a misparse than a real answer.
 */
function resolveDate(text, asOf, { preferPast = true } = {}) {
  const lower = text.toLowerCase();

  if (/\btoday\b|\bthis morning\b|\bthis afternoon\b/.test(lower)) return asOf;
  if (/\byesterday\b/.test(lower)) return addDays(asOf, -1);
  if (/\btomorrow\b/.test(lower)) return addDays(asOf, 1);

  const agoMatch = /\b(\d{1,2})\s*(day|days|week|weeks)\s*ago\b/.exec(lower);
  if (agoMatch) {
    const n = Number(agoMatch[1]) * (agoMatch[2].startsWith('week') ? 7 : 1);
    return addDays(asOf, -n);
  }

  const inMatch = /\bin\s+(\d{1,2})\s*(day|days|week|weeks)\b/.exec(lower);
  if (inMatch) {
    const n = Number(inMatch[1]) * (inMatch[2].startsWith('week') ? 7 : 1);
    return addDays(asOf, n);
  }

  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(lower);
  if (iso) return iso[0];

  // "12 aug" / "12 august" / "aug 12"
  const dayMonth = /\b(\d{1,2})\s*(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.exec(lower);
  const monthDay = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})\b/i.exec(lower);
  const md = dayMonth
    ? { day: Number(dayMonth[1]), month: MONTHS.indexOf(dayMonth[2].toLowerCase().slice(0, 3)) }
    : monthDay
      ? { day: Number(monthDay[2]), month: MONTHS.indexOf(monthDay[1].toLowerCase().slice(0, 3)) }
      : null;

  if (md && md.month >= 0) {
    const year = Number(asOf.slice(0, 4));
    const candidate = `${year}-${String(md.month + 1).padStart(2, '0')}-${String(md.day).padStart(2, '0')}`;
    const delta = daysBetween(asOf, candidate);
    // Handle a December date being discussed in January and vice versa.
    if (delta !== null && delta > 180) return `${year - 1}${candidate.slice(4)}`;
    if (delta !== null && delta < -180) return `${year + 1}${candidate.slice(4)}`;
    return candidate;
  }

  // Bare weekday - resolve to the nearest one in the preferred direction.
  const weekdayMatch = /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.exec(lower);
  if (weekdayMatch) {
    const target = WEEKDAYS.indexOf(weekdayMatch[1].toLowerCase());
    const asOfDow = new Date(`${asOf}T00:00:00Z`).getUTCDay();
    const explicitlyNext = /\bnext\b/.test(lower);
    const wantsFuture = explicitlyNext || !preferPast;

    let delta = target - asOfDow;
    if (wantsFuture) {
      if (delta <= 0) delta += 7;
      // "next Friday" said on a Thursday means the Friday of the following
      // week, not tomorrow. Resolve it to the next calendar week rather than
      // the next occurrence, which is how it is meant on site.
      if (explicitlyNext && weekIndex(addDays(asOf, delta)) === weekIndex(asOf)) {
        delta += 7;
      }
    } else if (delta >= 0) {
      delta -= 7;
    }
    return addDays(asOf, delta);
  }

  return null;
}

function detectDelay(text) {
  for (const cue of DELAY_CUES) {
    if (cue.pattern.test(text)) {
      return { detected: true, hint: cue.hint, matched: cue.pattern.source };
    }
  }
  return { detected: false };
}

/**
 * @param {string} text        the raw reply
 * @param {object} context     { asOf, exception } - the question being answered
 * @returns {object} structured update plus a list of what stayed ambiguous
 */
export function parseReply(text, context = {}) {
  const asOf = context.asOf ?? dayOf(new Date().toISOString());
  const raw = String(text ?? '').trim();
  const exception = context.exception ?? {};

  const result = {
    raw,
    status: null,
    percentComplete: null,
    actualStart: null,
    actualFinish: null,
    forecastFinish: null,
    remainingDays: null,
    delay: null,
    ambiguous: [],
    confidence: 'low',
  };

  if (raw === '') {
    result.ambiguous.push('empty reply');
    return result;
  }

  // Percent complete. Accept "30%", "30 percent"; "about a third" is not
  // guessed - vagueness stays vague. No trailing \b after the unit, because
  // "%" is not a word character and "30%" at end of line would never match.
  const percentMatch = /(\d{1,3})\s*(?:%|percent\b|pct\b)/i.exec(raw);
  let statedPercent = null;
  if (percentMatch) {
    const value = Number(percentMatch[1]);
    if (value >= 0 && value <= 100) {
      result.percentComplete = value;
      statedPercent = value;
    } else {
      // Out of range is a typo, not a reading. Record the doubt rather than
      // storing a number that will end up in a payment application.
      statedPercent = Number.NaN;
      result.ambiguous.push(`stated ${value}% is out of range`);
    }
  }

  const remainingMatch = /\b(\d{1,3})\s*(day|days|week|weeks)\s*(?:left|remaining|to go|more)\b/i.exec(raw);
  if (remainingMatch) {
    result.remainingDays = Number(remainingMatch[1]) * (remainingMatch[2].startsWith('week') ? 7 : 1);
  }

  // "30% done" contains the word "done" but plainly is not complete. A stated
  // percentage always beats a completion keyword.
  const percentContradictsComplete = statedPercent !== null && statedPercent !== 100;
  const isComplete = COMPLETE.test(raw) && !NEGATIVE.test(raw) && !percentContradictsComplete;
  const isNegative = NEGATIVE.test(raw);
  const isStarted = STARTED.test(raw) && !isNegative;

  if (isComplete) {
    result.status = 'complete';
    result.percentComplete = 100;
    result.actualFinish = resolveDate(raw, asOf, { preferPast: true }) ?? asOf;
  } else if (isNegative) {
    result.status = 'not-started';
  } else if (isStarted || result.percentComplete > 0) {
    result.status = 'in-progress';
  } else if (/^(y|yes|yep|yeah|ok|correct|confirmed)\b/i.test(raw)) {
    // A bare "yes" answers whatever the question asked.
    if (exception.kind === 'overdue-start' || exception.kind === 'starting-critical') {
      result.status = 'in-progress';
    } else if (exception.kind === 'overdue-finish') {
      result.status = 'complete';
      result.percentComplete = 100;
    } else {
      result.status = 'on-track';
    }
  } else if (/^(n|no|nope|not really)\b/i.test(raw)) {
    result.status = exception.kind === 'overdue-start' ? 'not-started' : 'at-risk';
  }

  // Dates. Which field a date lands in depends on what was asked and what the
  // reply says, so bias by the verb rather than by position.
  const mentionsStart = /\bstart(ed|ing)?\b|\bcommenc|\bbegan\b|\bbegun\b/i.test(raw);
  const mentionsFinish = /\bfinish(ed|ing)?\b|\bcomplete|\bdone\b|\bhand(ed)? over\b/i.test(raw);
  const mentionsFuture = /\bwill\b|\bexpect|\bforecast|\bby\b|\bshould\b|\bplan(ning)? to\b/i.test(raw);

  const pastDate = resolveDate(raw, asOf, { preferPast: true });
  const futureDate = resolveDate(raw, asOf, { preferPast: false });

  if (result.status === 'complete' && !result.actualFinish) {
    result.actualFinish = pastDate ?? asOf;
  }

  if (mentionsStart && result.status === 'in-progress' && pastDate) {
    result.actualStart = pastDate;
  }

  if (mentionsFinish && mentionsFuture && futureDate) {
    result.forecastFinish = futureDate;
  } else if (mentionsFuture && futureDate && !result.forecastFinish && result.status !== 'complete') {
    result.forecastFinish = futureDate;
  }

  // A started activity with no stated date, answering an overdue-start
  // question, most likely started on or after the planned start - but that is a
  // guess, so ask rather than assume.
  if (result.status === 'in-progress' && !result.actualStart) {
    result.ambiguous.push('start date not stated');
  }
  if (result.status === 'in-progress' && result.percentComplete === null) {
    result.ambiguous.push('percent complete not stated');
  }
  if (result.status === null) {
    result.ambiguous.push('could not determine status');
  }

  const delay = detectDelay(raw);
  if (delay.detected) {
    result.delay = {
      description: raw,
      responsibilityHint: delay.hint,
      // Never concluded automatically. The agent asks; a human decides.
      responsibility: null,
      needsClassification: delay.hint === 'unclear' || delay.hint === 'neutral',
    };
  }

  const known = [result.status, result.percentComplete, result.actualStart, result.actualFinish].filter(
    (v) => v !== null,
  ).length;
  result.confidence = result.ambiguous.length === 0 && known >= 2 ? 'high' : known >= 1 ? 'medium' : 'low';

  return result;
}

export const _internals = { resolveDate, detectDelay };
