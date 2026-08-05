/**
 * Keeping the Ledger in step across machines.
 *
 * The Mac mini runs the bot; you also want the project on a laptop. That is the
 * problem git remotes exist for, and it is emphatically NOT the problem file-sync
 * tools solve: Drive, Dropbox and iCloud sync `.git` internals file-by-file and out
 * of order, so two machines writing a synced repository corrupts it. For a record
 * that has to stand up in a dispute, "usually works" is not a standard.
 *
 * This is a thin, careful wrapper over pull-and-push. The care is in the failure
 * path: a half-finished rebase is a genuinely bad place to leave someone who does
 * not use git daily, so a conflict aborts cleanly and says what to do.
 */

import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ledgerRoot } from './paths.js';
import { repoRootFor } from './git.js';
import { exists } from './store.js';

const run = promisify(execFile);

async function git(args, cwd) {
  const { stdout } = await run('git', args, { cwd, maxBuffer: 10 * 1024 * 1024 });
  return stdout.trim();
}

/**
 * @param {{commitMessage?: string, push?: boolean}} options
 * @returns {Promise<object>} what happened, for the caller to print
 */
export async function syncLedger(options = {}) {
  const ledger = ledgerRoot();

  // A freshly cloned laptop hits this first: the repo is there, but the projects
  // folder inside it has not been created yet. Saying "not a git repository"
  // would send you chasing the wrong problem.
  if (!(await exists(ledger))) {
    const parent = await repoRootFor(path.dirname(ledger));
    return {
      status: 'no-ledger-dir',
      message: parent
        ? `LEDGER_ROOT points at ${ledger}, which does not exist yet — though ${parent} is a repository.\n` +
          `Create it with \`mkdir -p ${ledger}\`, or check LEDGER_ROOT points where you think.`
        : `LEDGER_ROOT points at ${ledger}, which does not exist.`,
    };
  }

  const root = await repoRootFor(ledger);

  if (!root) {
    return {
      status: 'not-a-repo',
      message:
        `${ledgerRoot()} is not inside a git repository, so there is nothing to sync.\n` +
        `Run \`git init\` in the ledger folder first.`,
    };
  }

  let remote = null;
  try {
    remote = await git(['remote', 'get-url', 'origin'], root);
  } catch {
    return {
      status: 'no-remote',
      root,
      message:
        `The ledger at ${root} has no remote, so it only exists on this machine.\n\n` +
        `To work on it from a laptop as well, add one:\n` +
        `  git -C ${root} remote add origin <url>\n` +
        `  git -C ${root} push -u origin main\n\n` +
        `Use a PRIVATE repository. This holds contract sums, rates and claims strategy.`,
    };
  }

  const result = { status: 'ok', root, remote, committed: false, pulled: 0, pushed: 0 };

  // Commit anything edited by hand. Everything else in this system commits as it
  // writes, so a dirty tree means a human edited a register - which should not
  // block a sync.
  const dirty = await git(['status', '--porcelain'], root);
  if (dirty) {
    await git(['add', '-A'], root);
    await git(
      ['commit', '--no-verify', '-m', options.commitMessage ?? 'ledger: local edits before sync'],
      root,
    );
    result.committed = true;
    result.committedFiles = dirty.split('\n').length;
  }

  // `rev-parse HEAD` fails on an unborn branch, which is exactly the state a
  // freshly cloned empty ledger is in on a new laptop. `symbolic-ref` works
  // there, so ask it instead.
  const branch = await git(['symbolic-ref', '--short', 'HEAD'], root).catch(() => 'main');
  const hasCommits = await git(['rev-parse', '--verify', '--quiet', 'HEAD'], root)
    .then(() => true)
    .catch(() => false);

  result.branch = branch;

  // Does the remote know this branch yet? A fresh clone of an empty repository
  // has no upstream, and assuming it does is how work silently strands on one
  // machine.
  await git(['fetch', 'origin'], root).catch(() => {});
  const remoteRef = `origin/${branch}`;
  const remoteExists = await git(['rev-parse', '--verify', '--quiet', remoteRef], root)
    .then(() => true)
    .catch(() => false);

  const before = hasCommits ? await git(['rev-parse', 'HEAD'], root) : null;

  try {
    if (remoteExists) await git(['pull', '--rebase', 'origin', branch], root);
  } catch (error) {
    // Never leave a half-applied rebase behind.
    await git(['rebase', '--abort'], root).catch(() => {});

    return {
      ...result,
      status: 'conflict',
      message:
        `The laptop and the Mac mini both changed the same thing, so the sync was rolled back — nothing is half-applied.\n\n` +
        `Resolve it where you can see both versions:\n` +
        `  git -C ${root} pull --rebase\n` +
        `  # fix the conflicting files, then\n` +
        `  git -C ${root} rebase --continue\n\n` +
        `Detail: ${String(error.stderr ?? error.message).trim().slice(0, 400)}`,
    };
  }

  const afterPull = await git(['rev-parse', '--verify', '--quiet', 'HEAD'], root).catch(() => null);
  if (afterPull && before && afterPull !== before) {
    result.pulled = Number(await git(['rev-list', '--count', `${before}..${afterPull}`], root));
  } else if (afterPull && !before) {
    // The branch was unborn and the pull brought its whole history.
    result.pulled = Number(await git(['rev-list', '--count', 'HEAD'], root));
  }

  if (options.push !== false) {
    // Count against the remote branch itself rather than @{u}: the upstream may
    // not be configured, and a failure to read it must never be read as "nothing
    // to push".
    const local = await git(['rev-parse', '--verify', '--quiet', 'HEAD'], root).catch(() => null);
    const ahead = !local
      ? 0
      : remoteExists
        ? Number(await git(['rev-list', '--count', `${remoteRef}..HEAD`], root))
        : Number(await git(['rev-list', '--count', 'HEAD'], root));

    if (ahead > 0) {
      // -u on the first push so the branch is tracked from then on.
      await git(remoteExists ? ['push', 'origin', branch] : ['push', '-u', 'origin', branch], root);
      result.pushed = ahead;
    }
  }

  result.message =
    result.pulled === 0 && result.pushed === 0
      ? 'Already in step.'
      : [
          result.pulled ? `Pulled ${result.pulled} change(s) from ${remote}.` : null,
          result.pushed ? `Pushed ${result.pushed} change(s).` : null,
        ]
          .filter(Boolean)
          .join(' ');

  return result;
}
