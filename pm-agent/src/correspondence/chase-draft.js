/**
 * Chase letters, from a deterministic template.
 *
 * Written from the record, not generated prose. A template cannot invent a
 * consequence that nobody wrote down, cannot soften a date, and produces the same
 * letter twice for the same facts - which matters when a series of chasers becomes
 * the evidence that you pursued something diligently.
 *
 * Where the record is thin the letter says less, and lists what is missing at the
 * bottom for the drafter. It never fills the gap.
 *
 * Nothing here sends anything. Drafts land in 06-outputs/correspondence/.
 */

import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { projectPaths } from '../ledger/paths.js';
import { readYaml, ensureDir } from '../ledger/store.js';
import { entriesOf, isOpen, subjectOf, ownerOf, dueOn, raisedOn } from '../ledger/registers.js';
import { today, formatHuman, daysBetween, addDays } from '../util/dates.js';

/** Registers a chase letter can be raised against, in search order. */
const SEARCHABLE = [
  { key: 'decisions', label: 'decision', noun: 'decision' },
  { key: 'actions', label: 'action', noun: 'action' },
  { key: 'rfi', label: 'RFI', noun: 'request for information' },
  { key: 'submittals', label: 'submittal', noun: 'submittal' },
  { key: 'ncr', label: 'NCR', noun: 'non-conformance' },
];

/** Find an entry by reference across the registers. */
export async function findEntry(projectCode, ref) {
  const paths = projectPaths(projectCode);
  const wanted = String(ref).trim().toUpperCase();

  for (const source of SEARCHABLE) {
    const register = await readYaml(paths[source.key]);
    const entry = entriesOf(register).find((e) => String(e.ref ?? '').toUpperCase() === wanted);
    if (entry) return { entry, source, register };
  }

  return null;
}

/**
 * @param {object} input { entry, source, projectCode, projectName, brand, asOf, responseDays }
 * @returns {{ body: string, missing: string[] }}
 */
export function buildChaseDraft(input) {
  const { entry, source, projectCode, projectName, brand = {}, asOf = today(), responseDays = null } = input;

  const missing = [];
  const owner = ownerOf(entry);
  const due = dueOn(entry);
  const raised = raisedOn(entry);
  const subject = subjectOf(entry);

  if (!owner) missing.push('No owner recorded — the letter is addressed generically.');
  if (!due && !raised) missing.push('No due date or raised date recorded — the letter cannot state a deadline.');
  if (!entry.consequence) {
    missing.push('No consequence recorded — the paragraph explaining the effect of further delay is omitted.');
  }

  const lines = [];

  lines.push(`# Chase — ${entry.ref}`);
  lines.push('');
  lines.push(`**Our ref:** ${projectCode}/CHASE/${entry.ref}  `);
  lines.push(`**Date:** ${formatHuman(asOf)}  `);
  lines.push(`**To:** ${owner ?? '[recipient]'}  `);
  if (brand.issuer?.name) {
    lines.push(`**From:** ${brand.issuer.name}${brand.issuer.title ? `, ${brand.issuer.title}` : ''}  `);
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(`Dear ${owner ? 'Sirs' : '[recipient]'},`);
  lines.push('');
  lines.push(`## ${projectName ?? projectCode} — ${subject}`);
  lines.push('');

  // The factual paragraph. Every number here comes from the register.
  if (raised) {
    const daysOpen = daysBetween(raised, asOf);
    const against = responseDays ? ` against a ${responseDays}-day period under the Contract` : '';
    lines.push(
      `We refer to ${source.label} ${entry.ref}, "${subject}", ` +
        `issued on ${formatHuman(raised)}. It has now been outstanding for ${daysOpen} days${against}, ` +
        `and remains unanswered.`,
    );
  } else if (due) {
    const remaining = daysBetween(asOf, due);
    lines.push(
      remaining < 0
        ? `We refer to ${source.label} ${entry.ref}, "${subject}", which was due on ` +
          `${formatHuman(due)} and is now ${Math.abs(remaining)} days overdue.`
        : `We refer to ${source.label} ${entry.ref}, "${subject}", which falls due on ` +
          `${formatHuman(due)}.`,
    );
  } else {
    lines.push(`We refer to ${source.label} ${entry.ref}, "${subject}", which remains outstanding.`);
  }

  lines.push('');

  // Only stated when it was actually recorded. This is the paragraph that makes a
  // chaser work, and an invented one would be worse than none.
  if (entry.consequence) {
    lines.push(`The effect of further delay is as follows: ${entry.consequence}.`);
    lines.push('');
  }

  if (entry.activity) {
    lines.push(`The matter affects programme activity ${entry.activity}.`);
    lines.push('');
  }

  const replyBy = due && daysBetween(asOf, due) > 0 ? due : addDays(asOf, 7);
  lines.push(`We should be grateful for your response by ${formatHuman(replyBy)}.`);
  lines.push('');
  lines.push('Yours faithfully,');
  lines.push('');
  lines.push(brand.issuer?.name ?? '[name]');
  if (brand.issuer?.title) lines.push(brand.issuer.title);
  lines.push(brand.company?.name ?? '');
  lines.push('');

  if (missing.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## Not in the record');
    lines.push('');
    lines.push('This draft omits the following because it is not recorded in the Ledger.');
    lines.push('Add it to the register and regenerate rather than writing it in here.');
    lines.push('');
    for (const item of missing) lines.push(`- ${item}`);
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('_Draft only. Review, then send it yourself._');

  return { body: lines.join('\n'), missing };
}

/**
 * Build and write the draft. Returns null when the reference is unknown.
 */
export async function writeChaseDraft(projectCode, ref, { asOf = today(), brand = {} } = {}) {
  const found = await findEntry(projectCode, ref);
  if (!found) return null;

  const paths = projectPaths(projectCode);
  const config = (await readYaml(paths.config)) ?? {};

  const responseDays =
    found.source.key === 'rfi'
      ? config.contract?.rfiResponseDays
      : found.source.key === 'submittals'
        ? config.contract?.submittalResponseDays
        : null;

  const { body, missing } = buildChaseDraft({
    entry: found.entry,
    source: found.source,
    projectCode,
    projectName: config.name ?? projectCode,
    brand,
    asOf,
    responseDays,
  });

  const dir = path.join(paths.outputs, 'correspondence');
  await ensureDir(dir);
  const file = path.join(dir, `${asOf}-chase-${found.entry.ref}.md`);
  await writeFile(file, body, 'utf8');

  return { file, body, missing, entry: found.entry, source: found.source };
}

/** Everything currently open and chaseable, worst first. */
export async function openItems(projectCode, { asOf = today() } = {}) {
  const paths = projectPaths(projectCode);
  const items = [];

  for (const source of SEARCHABLE) {
    for (const entry of entriesOf(await readYaml(paths[source.key]))) {
      if (!isOpen(entry)) continue;
      const due = dueOn(entry);
      items.push({
        ref: entry.ref,
        register: source.label,
        subject: subjectOf(entry),
        owner: ownerOf(entry),
        due,
        daysRemaining: due ? daysBetween(asOf, due) : null,
        daysOpen: raisedOn(entry) ? daysBetween(raisedOn(entry), asOf) : null,
        consequence: entry.consequence ?? null,
        activity: entry.activity ?? null,
      });
    }
  }

  return items.sort((a, b) => (a.daysRemaining ?? 9999) - (b.daysRemaining ?? 9999));
}
