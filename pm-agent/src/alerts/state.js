/**
 * Alert state: what has already been said, and at what severity.
 *
 * Stored in `02-ledger/alerts.yaml` and **committed**, not treated as transient
 * cache. "You were warned about this on that date" is itself a contemporaneous
 * record, and it belongs in the git history next to the diary. It is also how you
 * demonstrate, later, that a risk was flagged before it materialised.
 */

import { projectPaths } from '../ledger/paths.js';
import { readYaml, writeYaml } from '../ledger/store.js';

const EMPTY = { updatedAt: null, entries: [] };

export async function loadAlertState(projectCode) {
  const state = await readYaml(projectPaths(projectCode).alerts);
  return state && Array.isArray(state.entries) ? state : { ...EMPTY, entries: [] };
}

export async function saveAlertState(projectCode, state) {
  const file = projectPaths(projectCode).alerts;
  await writeYaml(file, state, {
    header: 'Alert history - what was flagged, when, and at what severity',
  });
  return file;
}

/**
 * Decide what actually gets sent.
 *
 * The quiet rule, and the whole point of this module:
 *   - a key never seen before  -> send
 *   - a key whose tier has risen since it was last sent -> send
 *   - anything else -> update the record silently
 *
 * Pure: takes state, returns new state. No I/O, so the dedupe logic is testable.
 *
 * @param {Array<object>} candidates from evaluateAlerts
 * @param {object} state            previous alerts.yaml contents
 * @param {{asOf: string}} options
 * @returns {{state: object, toSend: Array, resolved: Array, open: Array}}
 */
export function reconcile(candidates, state, { asOf }) {
  const previous = state?.entries ?? [];
  const entries = previous.map((entry) => ({ ...entry }));

  const byKey = new Map();
  for (const entry of entries) {
    // Only unresolved entries are live. A condition that cleared and came back is
    // genuinely news, so it gets a fresh entry and alerts again.
    if (!entry.resolvedAt) byKey.set(entry.key, entry);
  }

  const toSend = [];
  const seen = new Set();

  for (const candidate of candidates) {
    seen.add(candidate.key);
    const existing = byKey.get(candidate.key);

    if (!existing) {
      const entry = {
        key: candidate.key,
        condition: candidate.condition,
        ref: candidate.ref ?? null,
        activity: candidate.activity ?? null,
        title: candidate.title,
        detail: candidate.detail,
        due: candidate.due ?? null,
        tier: candidate.tier,
        tierLabel: candidate.tierLabel,
        severity: candidate.severity,
        firstSeen: asOf,
        lastSentAt: asOf,
        lastSentTier: candidate.tier,
        timesSent: 1,
        resolvedAt: null,
      };
      entries.push(entry);
      byKey.set(candidate.key, entry);
      toSend.push({ ...candidate, reason: 'new' });
      continue;
    }

    // Always refresh the description, even when staying silent, so the record and
    // any on-demand listing reflect the current position.
    existing.title = candidate.title;
    existing.detail = candidate.detail;
    existing.due = candidate.due ?? null;
    existing.tier = candidate.tier;
    existing.tierLabel = candidate.tierLabel;
    existing.severity = candidate.severity;

    if (existing.snoozedUntil && existing.snoozedUntil > asOf) continue;

    if (candidate.tier > (existing.lastSentTier ?? 0)) {
      existing.lastSentAt = asOf;
      existing.lastSentTier = candidate.tier;
      existing.timesSent = (existing.timesSent ?? 0) + 1;
      toSend.push({ ...candidate, reason: 'escalated', previousTier: existing.lastSentTier });
    }
  }

  // Anything live that no longer fires has been dealt with.
  const resolved = [];
  for (const entry of entries) {
    if (entry.resolvedAt || seen.has(entry.key)) continue;
    entry.resolvedAt = asOf;
    resolved.push(entry);
  }

  return {
    state: { updatedAt: asOf, entries },
    toSend,
    resolved,
    open: entries.filter((entry) => !entry.resolvedAt),
  };
}

/** Silence one alert key until a date. Used by `/snooze` and by hand editing. */
export function snooze(state, key, until) {
  const entry = (state.entries ?? []).find((e) => e.key === key && !e.resolvedAt);
  if (!entry) return false;
  entry.snoozedUntil = until;
  return true;
}
