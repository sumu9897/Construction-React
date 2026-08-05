/**
 * Load `.env` from the package root.
 *
 * Without this, copying a token into `.env` does nothing - the process only ever
 * sees what the shell exported - and the failure looks like a broken bot token
 * rather than a file that was never read.
 *
 * Deliberately no dependency: this is a dozen lines and the package is meant to
 * stay installable with one `npm install` on a machine that has to keep running
 * unattended.
 */

import path from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, '../..');

/** Strip matching surrounding quotes, which people add out of habit. */
function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && /^(".*"|'.*')$/s.test(trimmed)) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseEnv(text) {
  const out = {};

  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;

    // Tolerate `export KEY=value`, which is what people paste.
    const withoutExport = line.replace(/^export\s+/, '');
    const eq = withoutExport.indexOf('=');
    if (eq <= 0) continue;

    const key = withoutExport.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    out[key] = unquote(withoutExport.slice(eq + 1));
  }

  return out;
}

/**
 * Apply `.env` without overriding anything already set.
 *
 * The real environment wins on purpose: under launchd the plist is the source of
 * truth, and a stale `.env` left in the checkout must not quietly override it.
 *
 * @returns {string[]} the keys that were applied
 */
export function loadEnv(file = path.join(packageRoot, '.env')) {
  if (!existsSync(file)) return [];

  let parsed;
  try {
    parsed = parseEnv(readFileSync(file, 'utf8'));
  } catch {
    return [];
  }

  const applied = [];
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = value;
      applied.push(key);
    }
  }

  return applied;
}
