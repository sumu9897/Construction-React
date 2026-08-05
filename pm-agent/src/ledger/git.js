/**
 * Git is the audit trail.
 *
 * Construction disputes turn on contemporaneous records. Every ledger write is
 * committed immediately so that the history of what you knew, and when you knew
 * it, is timestamped and tamper-evident. `git log 02-ledger/diary.md` eighteen
 * months later is evidence.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { exists } from './store.js';
import path from 'node:path';

const run = promisify(execFile);

async function git(args, cwd) {
  const { stdout } = await run('git', args, { cwd, maxBuffer: 10 * 1024 * 1024 });
  return stdout.trim();
}

/** Nearest enclosing git working tree, or null if the ledger is not in one. */
export async function repoRootFor(target) {
  try {
    return await git(['rev-parse', '--show-toplevel'], target);
  } catch {
    return null;
  }
}

/**
 * Stage the given paths and commit. Returns the commit sha, or null when there
 * was nothing to commit (which is normal and not an error).
 *
 * Never throws on a dirty-state edge case: a failed commit must not take the
 * Telegram bot down mid-conversation, it should surface as a warning while the
 * ledger file on disk is already correct.
 */
export async function commitLedger(targets, message, { cwd } = {}) {
  const paths = (Array.isArray(targets) ? targets : [targets]).filter(Boolean);
  if (paths.length === 0) return null;

  const base = cwd ?? path.dirname(paths[0]);
  if (!(await exists(base))) return null;

  const root = await repoRootFor(base);
  if (!root) return null;

  try {
    await git(['add', '--', ...paths], root);

    const staged = await git(['diff', '--cached', '--name-only'], root);
    if (staged === '') return null;

    await git(['commit', '--no-verify', '-m', message], root);
    return await git(['rev-parse', 'HEAD'], root);
  } catch (error) {
    console.warn(`[ledger] commit failed (files are still written): ${error.message}`);
    return null;
  }
}

/** History of a single ledger file - the evidence trail for one record. */
export async function fileHistory(file, limit = 20) {
  const root = await repoRootFor(path.dirname(file));
  if (!root) return [];
  try {
    const log = await git(
      ['log', `-${limit}`, '--format=%H%x09%aI%x09%s', '--', file],
      root,
    );
    if (!log) return [];
    return log.split('\n').map((line) => {
      const [sha, date, subject] = line.split('\t');
      return { sha, date, subject };
    });
  } catch {
    return [];
  }
}
