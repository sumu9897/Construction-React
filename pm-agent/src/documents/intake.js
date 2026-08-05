/**
 * Getting documents into the Ledger from somewhere else.
 *
 * The Ledger lives on one machine. You are frequently not at that machine, and the
 * contract, the drawings and the letters all still have to reach it. This handles
 * both routes: a file sent to the Telegram bot from a phone, and a file dropped
 * into a watched inbox folder by whatever sync tool you already use.
 *
 * Every document is hashed on arrival. For a contract that matters: "this is the
 * document as received on 5 August, sha256 a1b2..." is a defensible statement, and
 * it is how you later prove which revision a claim was argued against.
 */

import path from 'node:path';
import { createHash } from 'node:crypto';
import { writeFile, readFile, readdir, unlink, stat } from 'node:fs/promises';
import { projectPaths } from '../ledger/paths.js';
import { readYaml, writeYaml, ensureDir, exists } from '../ledger/store.js';
import { commitLedger } from '../ledger/git.js';
import { today } from '../util/dates.js';

/**
 * Where each kind of document belongs. Keys are matched against a caption or a
 * subfolder name, so "contract" in either routes to 00-contract/.
 */
export const CATEGORIES = {
  contract: { dir: 'contract', label: 'Contract' },
  conditions: { dir: 'contract', label: 'Contract' },
  boq: { dir: 'contract', label: 'Contract' },
  drawing: { dir: 'drawings', label: 'Drawing' },
  drawings: { dir: 'drawings', label: 'Drawing' },
  ifc: { dir: 'drawings', label: 'Drawing' },
  correspondence: { dir: 'correspondence', label: 'Correspondence' },
  letter: { dir: 'correspondence', label: 'Correspondence' },
  email: { dir: 'correspondence', label: 'Correspondence' },
  minutes: { dir: 'minutes', label: 'Minutes' },
  mom: { dir: 'minutes', label: 'Minutes' },
  commercial: { dir: 'commercial', label: 'Commercial' },
  valuation: { dir: 'commercial', label: 'Commercial' },
  invoice: { dir: 'commercial', label: 'Commercial' },
  // Anything unrecognised is still filed - never dropped.
  document: { dir: 'documents', label: 'Document' },
};

const DEFAULT_CATEGORY = 'document';

/** Pick a category from free text, e.g. a Telegram caption or a folder name. */
export function categorise(hint) {
  if (!hint) return DEFAULT_CATEGORY;
  const words = String(hint).toLowerCase().split(/[^a-z]+/).filter(Boolean);
  for (const word of words) {
    if (CATEGORIES[word]) return word;
  }
  return DEFAULT_CATEGORY;
}

/**
 * Make a filename safe to write.
 *
 * Filenames arrive from Telegram and from synced folders, so they are untrusted:
 * a name containing path separators could otherwise write outside the project.
 */
export function safeFilename(name, fallback = 'document') {
  // Take the last path segment on either separator style. `path.basename` alone
  // is not enough: on macOS and Linux it does not treat "\" as a separator, so a
  // Windows-style name would survive with its directories glued together.
  const base = String(name ?? '')
    .trim()
    .split(/[/\\]/)
    .pop();

  const cleaned = base
    .replace(/[^\w.\-() ]+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 120)
    .trim();
  return cleaned || fallback;
}

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

/**
 * File one document into the Ledger.
 *
 * @param {string} projectCode
 * @param {object} input
 * @param {Buffer} input.buffer
 * @param {string} input.filename    as supplied; sanitised here
 * @param {string} [input.category]  or inferred from `hint`
 * @param {string} [input.hint]      caption or folder name to categorise from
 * @param {object} [input.author]    { id, name }
 * @param {string} [input.note]
 */
export async function fileDocument(projectCode, input) {
  const paths = projectPaths(projectCode);
  const day = input.asOf ?? today();
  const author = input.author ?? { id: 'terminal', name: 'terminal' };

  const category = input.category ?? categorise(input.hint ?? input.filename);
  const target = CATEGORIES[category] ?? CATEGORIES[DEFAULT_CATEGORY];
  const dir = paths[target.dir];

  await ensureDir(dir);

  const filename = safeFilename(input.filename);
  const hash = sha256(input.buffer);

  // Same bytes already filed - do not write a duplicate. Sync folders re-deliver
  // the same file routinely, and a contract appearing three times is worse than
  // useless.
  const index = (await readYaml(paths.documentIndex)) ?? { entries: [] };
  index.entries ??= [];

  const duplicate = index.entries.find((entry) => entry.sha256 === hash);
  if (duplicate) {
    return { status: 'duplicate', of: duplicate, hash, category: target.label };
  }

  // Prefix with the date so the folder stays chronological, and never overwrite.
  let file = path.join(dir, `${day}-${filename}`);
  let counter = 2;
  while (await exists(file)) {
    const ext = path.extname(filename);
    file = path.join(dir, `${day}-${path.basename(filename, ext)}-${counter}${ext}`);
    counter += 1;
  }

  await writeFile(file, input.buffer);

  const record = {
    date: day,
    file: path.relative(paths.root, file),
    originalName: input.filename ?? null,
    category: target.label,
    bytes: input.buffer.length,
    // The reason this register exists: proving which revision you had, and when.
    sha256: hash,
    receivedFrom: author.name,
    receivedById: author.id,
    via: input.via ?? 'unknown',
    note: input.note ?? null,
    receivedAt: new Date().toISOString(),
  };

  index.entries.push(record);
  await writeYaml(paths.documentIndex, index, {
    header: 'Documents received - what arrived, when, from whom, and its hash',
  });

  const sha = await commitLedger(
    [file, paths.documentIndex],
    `docs(${projectCode}): ${target.label.toLowerCase()} "${filename}" from ${author.name}`,
  );

  return { status: 'filed', file, record, commit: sha, category: target.label };
}

/**
 * Process an inbox folder.
 *
 * The inbox is deliberately NOT inside the git repository. Drive, Dropbox and
 * iCloud all corrupt `.git` internals when they sync a repo directly, which would
 * destroy the audit trail this system exists to keep. Syncing into a plain folder
 * and moving files across is safe with every one of them.
 *
 * Layout: <inbox>/<PROJECT-CODE>/<category>/file.pdf, where the category folder is
 * optional.
 *
 * @param {string} projectCode
 * @param {string} inboxRoot   folder to drain
 */
export async function drainInbox(projectCode, inboxRoot, options = {}) {
  const dir = path.join(inboxRoot, projectCode);
  const results = { filed: [], duplicates: [], skipped: [] };

  if (!(await exists(dir))) return results;

  const walk = async (current, hint) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(current, entry.name);

      if (entry.isDirectory()) {
        await walk(full, entry.name);
        continue;
      }

      // A file still being written by a sync client would otherwise be filed
      // half-complete, and its hash would be wrong forever.
      const info = await stat(full);
      const ageMs = Date.now() - info.mtimeMs;
      if (ageMs < (options.settleMs ?? 30_000)) {
        results.skipped.push({ file: entry.name, reason: 'still being written' });
        continue;
      }
      if (info.size === 0) {
        results.skipped.push({ file: entry.name, reason: 'empty' });
        continue;
      }

      const outcome = await fileDocument(projectCode, {
        buffer: await readFile(full),
        filename: entry.name,
        hint,
        author: options.author,
        via: 'inbox',
      });

      if (outcome.status === 'duplicate') {
        results.duplicates.push({ file: entry.name, of: outcome.of.file });
      } else {
        results.filed.push(outcome);
      }

      // Remove only after a successful write, so a crash never loses the file.
      if (options.keep !== true) await unlink(full);
    }
  };

  await walk(dir, null);
  return results;
}
