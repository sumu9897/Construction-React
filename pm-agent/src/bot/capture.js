/**
 * Logging register entries from the phone.
 *
 * A risk you thought of on the drive home is worth recording badly at 19:00; it
 * is worth nothing at all if it waits for you to open a laptop. So these accept
 * one line of free text and file it, then say plainly what was left blank rather
 * than inventing an owner, a date or an impact.
 *
 * Nothing here decides anything. Delay responsibility, entitlement and
 * measurement are never touched - this only appends what a human typed.
 */

import { readYaml, writeYaml } from '../ledger/store.js';
import { projectPaths } from '../ledger/paths.js';
import { commitLedger } from '../ledger/git.js';
import { nextRef } from '../ledger/registers.js';
import { today, dayOf } from '../util/dates.js';
import { parsePhrase, parseDatePhrase } from './phrase.js';

/**
 * The registers that can be written from a chat, and how a one-liner maps onto
 * their fields. Deliberately a small set: the ones you think of away from a desk.
 */
export const CAPTURE_KINDS = {
  risk: {
    prefix: 'RISK',
    pathKey: 'risk',
    label: 'Risk',
    buttonLabel: 'Risk',
    icon: '⚠️',
    header: 'Risk register',
    example: '/risk snow closes the Bcharreh road in December owner PMCC impact two weeks lost on external works',
  },
  decision: {
    prefix: 'DEC',
    pathKey: 'decisions',
    label: 'Decision required',
    buttonLabel: 'Decision needed',
    icon: '⚖️',
    header: 'Decisions required',
    example: '/decision approve balcony tile sample owner Client due 20 aug',
  },
  action: {
    prefix: 'ACT',
    pathKey: 'actions',
    label: 'Action',
    buttonLabel: 'Action',
    icon: '📌',
    header: 'Actions',
    example: '/action issue revised setting-out drawing owner Consultant due 12 aug',
  },
};

/**
 * Parse "subject | key: value | key: value".
 *
 * The pipe is the only syntax, because it is the one thing that survives being
 * typed with one thumb. Unknown keys are kept verbatim rather than dropped - a
 * field this parser has never heard of is still the author's words, and the
 * registers are hand-editable by design.
 */
export function parseCapture(text, { asOf } = {}) {
  const parts = String(text ?? '')
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean);

  const head = parts.shift() ?? '';
  const fields = {};
  const unparsed = [];

  for (const part of parts) {
    const match = /^([A-Za-z][A-Za-z ]*?)\s*:\s*(.+)$/.exec(part);
    if (!match) {
      unparsed.push(part);
      continue;
    }
    const key = match[1].trim().toLowerCase().replace(/\s+(.)/g, (_, c) => c.toUpperCase());
    fields[key] = match[2].trim();
  }

  // Read the subject the way it was spoken - "owner Jihad due by 1 aug". An
  // explicitly piped field always wins, so nothing a phrase happens to contain
  // can overwrite what the author spelled out.
  const spoken = parsePhrase(head, asOf ? { asOf } : {});
  for (const [key, value] of Object.entries(spoken.fields)) {
    if (fields[key] === undefined) fields[key] = value;
  }

  return { subject: spoken.subject, fields, unparsed };
}

/** Fields worth prompting for when they are absent, per register. */
const EXPECTED = {
  risk: ['owner', 'impact', 'mitigation'],
  decision: ['owner', 'due'],
  action: ['owner', 'due'],
};

/**
 * Append one entry to a register.
 *
 * @param {string} projectCode
 * @param {'risk'|'decision'|'action'} kind
 * @param {string} text     "subject | owner: X | due: YYYY-MM-DD"
 * @param {object} author   {name, id} - who said it, kept as attribution
 * @returns {Promise<{ref, entry, file, missing: string[], unparsed: string[]}|null>}
 */
export async function captureEntry(projectCode, kind, text, { author } = {}) {
  const spec = CAPTURE_KINDS[kind];
  if (!spec) return null;

  const { subject, fields, unparsed } = parseCapture(text);
  if (!subject) return null;

  const paths = projectPaths(projectCode);
  const file = paths[spec.pathKey];
  const register = (await readYaml(file)) ?? { nextRef: 1, entries: [] };
  register.entries ??= [];
  register.nextRef ??= register.entries.length + 1;

  const ref = nextRef(register, spec.prefix);

  // A date the author wrote is normalised; a date they did not write stays null.
  // "due" is the one field where a wrong guess would put a false deadline into a
  // register that drives chase letters.
  // parseDatePhrase first: dayOf only truncates to ten characters, so it would
  // happily store "friday" or "next week" as if it were a date.
  const due = fields.due ?? fields.by ?? fields.dueDate ?? null;
  const dueDay = due ? (parseDatePhrase(due) ?? dayOf(due)) : null;

  const entry = {
    ref,
    subject,
    date: today(),
    ...fields,
    ...(dueDay ? { dueDate: dueDay } : {}),
    status: 'open',
    raisedBy: author?.name ?? null,
    via: 'telegram',
  };
  delete entry.due;
  delete entry.by;
  delete entry.dueUnreadable;

  register.entries.push(entry);
  register.nextRef += 1;

  await writeYaml(file, register, { header: spec.header });
  await commitLedger([file], `ledger(${projectCode}): ${kind} ${ref} — ${subject.slice(0, 60)}`);

  const missing = (EXPECTED[kind] ?? []).filter((f) => !entry[f] && !(f === 'due' && entry.dueDate));

  return {
    ref,
    entry,
    file,
    missing,
    unparsed,
    label: spec.label,
    // A "due" the author clearly wrote but this parser could not read. Worth
    // saying out loud - silence would look like they never gave a date.
    dueUnreadable: fields.dueUnreadable ?? null,
  };
}

/**
 * Fill in a field on an entry already in a register.
 *
 * This is what the follow-up buttons drive, and it is also how you correct a
 * typo from the phone. It only ever sets the field named - it cannot close an
 * entry, and it cannot touch responsibility on a delay event.
 *
 * @returns {Promise<{ref, entry, field, value}|null>} null when the ref is unknown
 */
export async function amendEntry(projectCode, ref, field, value, { author } = {}) {
  const kind = Object.keys(CAPTURE_KINDS).find((k) =>
    String(ref).toUpperCase().startsWith(`${CAPTURE_KINDS[k].prefix}-`),
  );
  if (!kind) return null;

  const allowed = ['owner', 'due', 'impact', 'mitigation', 'consequence'];
  const key = String(field ?? '').toLowerCase();
  if (!allowed.includes(key)) return null;

  const spec = CAPTURE_KINDS[kind];
  const file = projectPaths(projectCode)[spec.pathKey];
  const register = await readYaml(file);
  const entry = register?.entries?.find((e) => String(e.ref).toUpperCase() === String(ref).toUpperCase());
  if (!entry) return null;

  let stored = String(value ?? '').trim();
  if (!stored) return null;

  if (key === 'due') {
    // parseDatePhrase first - dayOf is a truncator, not a validator.
    const day = parseDatePhrase(stored) ?? (/^\d{4}-\d{2}-\d{2}/.test(stored) ? dayOf(stored) : null);
    if (!day) return { ref: entry.ref, entry, field: key, value: null, unreadable: stored };
    entry.dueDate = day;
    stored = day;
  } else {
    entry[key] = stored;
  }

  entry.amendedBy = author?.name ?? null;
  entry.amendedOn = today();

  await writeYaml(file, register, { header: spec.header });
  await commitLedger([file], `ledger(${projectCode}): ${entry.ref} ${key} — ${stored.slice(0, 40)}`);

  return { ref: entry.ref, entry, field: key, value: stored, label: spec.label };
}
