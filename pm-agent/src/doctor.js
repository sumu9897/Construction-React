/**
 * Preflight checks, for setting this up on a machine that has to run unattended.
 *
 * Most of what goes wrong on a Mac mini is environmental rather than logical: a
 * launchd service with no HOME so the Claude login cannot be found, an empty
 * allowlist so every message is silently ignored, a LEDGER_ROOT that is not a git
 * repository so nothing is ever committed. All of those fail quietly at 7am. This
 * finds them at setup time instead.
 */

import os from 'node:os';
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { ledgerRoot } from './ledger/paths.js';
import { exists } from './ledger/store.js';
import { repoRootFor } from './ledger/git.js';
import { FONT_DIR } from './report/html/fonts.js';
import { transcriberConfigured } from './bot/transcribe.js';
import { runClaude, BUDGET_FLOOR_USD } from './bot/ask.js';

const ok = (name, detail) => ({ status: 'ok', name, detail });
const warn = (name, detail, fix) => ({ status: 'warn', name, detail, fix });
const fail = (name, detail, fix) => ({ status: 'fail', name, detail, fix });

function version(command, args = ['--version']) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch {
      resolve(null);
      return;
    }

    let out = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve(null);
    }, 10_000);

    child.stdout.on('data', (d) => {
      out += d;
    });
    child.on('error', () => {
      clearTimeout(timer);
      resolve(null);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve(code === 0 ? out.trim() : null);
    });
  });
}

/**
 * @param {{deep?: boolean}} options deep runs a trivial Claude call (a fraction of
 *   a cent) to prove the CLI is actually logged in, which is the one thing that
 *   cannot be established by looking at the filesystem.
 */
export async function diagnose(options = {}) {
  const checks = [];

  // --- runtime
  const major = Number(process.versions.node.split('.')[0]);
  checks.push(
    major >= 18
      ? ok('Node', `v${process.versions.node}`)
      : fail('Node', `v${process.versions.node}`, 'Node 18 or later is required.'),
  );

  // HOME is the one launchd routinely does not set, and everything below that
  // reads a dotfile depends on it.
  checks.push(
    process.env.HOME
      ? ok('HOME', process.env.HOME)
      : fail(
          'HOME',
          'not set',
          'Under launchd, add HOME to EnvironmentVariables in the plist. Without it the Claude login and git config cannot be found.',
        ),
  );

  // --- ledger
  const root = ledgerRoot();
  if (!(await exists(root))) {
    checks.push(fail('Ledger', `${root} does not exist`, 'Set LEDGER_ROOT, then run: pm init <CODE>'));
  } else {
    const repo = await repoRootFor(root);
    checks.push(
      repo
        ? ok('Ledger', `${root} (git: ${repo})`)
        : warn(
            'Ledger',
            `${root} is not inside a git repository`,
            'Run `git init` there. Without it nothing is committed, and the contemporaneous record - the point of the whole system - does not exist.',
          ),
    );

    const entries = await readdir(root, { withFileTypes: true });
    const projects = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.'));
    checks.push(
      projects.length > 0
        ? ok('Projects', projects.map((p) => p.name).join(', '))
        : warn('Projects', 'none found', 'pm init <CODE>'),
    );
  }

  // --- telegram
  checks.push(
    process.env.TELEGRAM_BOT_TOKEN
      ? ok('Telegram token', 'set')
      : warn('Telegram token', 'not set', 'Get one from @BotFather and set TELEGRAM_BOT_TOKEN.'),
  );

  const allowed = (process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  checks.push(
    allowed.length > 0
      ? ok('Telegram allowlist', `${allowed.length} chat id(s)`)
      : warn(
          'Telegram allowlist',
          'empty - the bot will ignore every message',
          'Start the bot, message it once, and copy the chat id from the log into TELEGRAM_ALLOWED_CHAT_IDS.',
        ),
  );

  // --- claude code
  const claudeBin = process.env.PM_CLAUDE_BIN || 'claude';
  const claudeVersion = await version(claudeBin);

  if (!claudeVersion) {
    checks.push(
      warn(
        'Claude Code',
        `\`${claudeBin}\` not found`,
        'Install it (npm i -g @anthropic-ai/claude-code) or set PM_CLAUDE_BIN. Only /ask needs it.',
      ),
    );
  } else if (options.deep) {
    // The only way to know it is logged in is to ask it something. The budget is
    // deliberately not tiny: a trivial call costs up to ~$0.25 on a cold prompt
    // cache, so a small cap would report a sign-in failure that is really a budget
    // failure.
    const probe = await runClaude({
      cwd: os.tmpdir(),
      prompt: 'Reply with exactly: READY',
      timeoutMs: 60_000,
      budgetUsd: 0.5,
    });

    checks.push(
      probe.ok
        ? ok('Claude Code', `${claudeVersion} — signed in, answered the probe`)
        : fail(
            'Claude Code',
            `${claudeVersion} — installed but the probe failed: ${probe.error}`,
            'Run `claude` once interactively as the user this service runs as, and sign in. The login lives in ~/.claude, so HOME must be set.',
          ),
    );
  } else {
    checks.push(
      ok(
        'Claude Code',
        `${claudeVersion} — run with --deep to confirm it is signed in`,
      ),
    );
  }

  const configuredBudget = Number(process.env.PM_CLAUDE_BUDGET_USD);
  if (configuredBudget && configuredBudget < BUDGET_FLOOR_USD) {
    checks.push(
      warn(
        'Question budget',
        `PM_CLAUDE_BUDGET_USD is $${configuredBudget}`,
        `A question costs up to about $0.25 when the prompt cache is cold, so anything under $${BUDGET_FLOOR_USD} will fail intermittently. Raise it.`,
      ),
    );
  }

  // --- reporting
  // Uses the same resolver as the PDF path, including the global-install fallback,
  // so this cannot report a false negative that sends you installing something you
  // already have.
  const { pdfCapability } = await import('./report/pdf.js');
  const pdf = await pdfCapability();

  checks.push(
    pdf.ok
      ? ok('Playwright', 'browser present - reports can be written as PDF')
      : warn('Playwright', `${pdf.reason} - reports will be HTML only`, pdf.fix),
  );

  const fonts = (await exists(FONT_DIR)) ? (await readdir(FONT_DIR)).filter((f) => f.endsWith('.woff2')) : [];
  checks.push(
    fonts.length >= 3
      ? ok('Report fonts', `${fonts.length} embedded`)
      : fail('Report fonts', `${fonts.length} found in ${FONT_DIR}`, 'Reports will render in a fallback face.'),
  );

  // --- optional
  checks.push(
    transcriberConfigured()
      ? ok('Voice notes', 'transcriber configured')
      : ok('Voice notes', 'off - the bot will ask for text instead (this is fine)'),
  );

  return checks;
}

export function formatDiagnosis(checks) {
  const mark = { ok: 'ok  ', warn: 'WARN', fail: 'FAIL' };
  const lines = [];

  for (const check of checks) {
    lines.push(`${mark[check.status]}  ${check.name.padEnd(20)} ${check.detail}`);
    if (check.fix) lines.push(`        ↳ ${check.fix}`);
  }

  const failed = checks.filter((c) => c.status === 'fail').length;
  const warned = checks.filter((c) => c.status === 'warn').length;

  lines.push('');
  lines.push(
    failed > 0
      ? `${failed} problem(s) will stop this working.`
      : warned > 0
        ? `Nothing broken; ${warned} thing(s) are not set up yet.`
        : 'All good.',
  );

  return lines.join('\n');
}
