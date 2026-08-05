/**
 * Read/write helpers for the Ledger.
 *
 * Registers are YAML so you can hand-edit them; parsed programmes are JSON
 * because they are machine-written and large; the diary is Markdown because it
 * is prose that ends up quoted verbatim in claims.
 */

import { mkdir, readFile, writeFile, readdir, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

export async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

export async function exists(target) {
  try {
    await access(target, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function readYaml(file, fallback = null) {
  if (!(await exists(file))) return fallback;
  const text = await readFile(file, 'utf8');
  const parsed = YAML.parse(text);
  return parsed ?? fallback;
}

export async function writeYaml(file, data, { header } = {}) {
  await ensureDir(path.dirname(file));
  // lineWidth: 0 disables wrapping. Wrapped long strings are technically valid
  // YAML but they make git diffs unreadable, which defeats the whole point of
  // keeping the ledger in git.
  const body = YAML.stringify(data, { lineWidth: 0 });
  const prefix = header ? `# ${header}\n# Managed by pm-agent. Hand edits are fine and are preserved.\n\n` : '';
  await writeFile(file, prefix + body, 'utf8');
}

export async function readJson(file, fallback = null) {
  if (!(await exists(file))) return fallback;
  return JSON.parse(await readFile(file, 'utf8'));
}

export async function writeJson(file, data, { pretty = true } = {}) {
  await ensureDir(path.dirname(file));
  await writeFile(file, JSON.stringify(data, null, pretty ? 2 : 0) + '\n', 'utf8');
}

export async function appendMarkdown(file, block) {
  await ensureDir(path.dirname(file));
  const existing = (await exists(file)) ? await readFile(file, 'utf8') : '';
  const separator = existing && !existing.endsWith('\n\n') ? '\n\n' : '';
  await writeFile(file, existing + separator + block.trimEnd() + '\n', 'utf8');
}

/**
 * Files in a directory matching a suffix, newest last by name.
 * XER exports are named YYYY-MM-DD-*.xer so a plain sort is chronological.
 */
export async function listFiles(dir, suffix) {
  if (!(await exists(dir))) return [];
  const entries = await readdir(dir);
  return entries
    .filter((name) => !suffix || name.toLowerCase().endsWith(suffix.toLowerCase()))
    .sort()
    .map((name) => path.join(dir, name));
}

export async function latestFile(dir, suffix) {
  const files = await listFiles(dir, suffix);
  return files.at(-1) ?? null;
}

/**
 * Append an entry to a YAML register, assigning the next sequential reference.
 * Registers are stored as { nextRef, entries: [...] } so references never get
 * reused even after an entry is deleted - a reused RFI number is a real problem
 * in a dispute.
 */
export async function appendToRegister(file, prefix, entry) {
  const register = (await readYaml(file)) ?? { nextRef: 1, entries: [] };
  register.entries ??= [];
  register.nextRef ??= register.entries.length + 1;

  const ref = `${prefix}-${String(register.nextRef).padStart(3, '0')}`;
  const record = { ref, ...entry };
  register.entries.push(record);
  register.nextRef += 1;

  await writeYaml(file, register);
  return record;
}
