/**
 * Answering questions from the Project Ledger, by running Claude Code headlessly
 * against the project folder.
 *
 * **Read-only is the safety property of this module.** The ledger holds contract
 * sums, rates and claims strategy, and an agent that can edit it could silently
 * rewrite the contemporaneous record that the whole system exists to protect. So
 * the restriction is enforced twice - an allowlist and a redundant deny list - and
 * `--permission-mode bypassPermissions` / `--dangerously-skip-permissions` are
 * deliberately never used. They would discard exactly the guarantee that makes it
 * safe to point this at a live project.
 *
 * Verified: with this flag set the model's attempts to Write and to shell-redirect
 * both land in `permission_denials` and no file is created.
 */

import { spawn } from 'node:child_process';
import { projectPaths } from '../ledger/paths.js';

const READ_ONLY_TOOLS = 'Read,Grep,Glob';
const DENIED_TOOLS = 'Write,Edit,NotebookEdit,Bash,WebFetch,WebSearch';

const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * A single call is not as cheap as it looks. Claude Code sends a large system
 * prompt, so the same trivial question costs about $0.01 when the prompt cache is
 * warm and about $0.25 when it is cold. A budget below roughly $0.35 therefore
 * fails intermittently - working all morning and then aborting after an idle
 * period, which is a miserable thing to debug.
 */
export const BUDGET_FLOOR_USD = 0.35;
const DEFAULT_BUDGET_USD = 0.5;

/**
 * The house rules. These mirror the rules the rest of the system follows, because
 * an answer about a contract that quietly invents a figure is worse than no answer.
 */
export const LEDGER_SYSTEM_PROMPT = `You are answering questions about a live construction project from its Project Ledger, which is your working directory.

Rules, in order of importance:

1. Answer ONLY from files in this directory. Never fill a gap with general knowledge about construction, contracts or programmes.
2. Cite the file path for every factual claim, like (02-ledger/diary.md) or (03-registers/rfi.yaml).
3. If the record does not answer the question, say "Not in the project record" and name what would have to be recorded for it to be answerable. Never estimate, never produce a plausible figure, never round a gap into a number.
4. Never state or imply who is contractually responsible for a delay unless a human recorded it in 02-ledger/events.yaml. Quote the recorded value, including "unclassified".
5. Quantities, dates and money are read from the record verbatim. If two files disagree, say so and cite both rather than picking one.
6. Be brief and direct. This is read on a phone on a construction site. No preamble, no restating the question, no bullet lists longer than five items.`;

/**
 * Low-level runner. Also used for structuring voice-note transcripts.
 *
 * @param {object} options
 * @param {string} options.cwd          directory the model may read
 * @param {string} options.prompt
 * @param {string} [options.systemPrompt]
 * @param {object} [options.jsonSchema] when set, the reply is validated JSON
 * @returns {Promise<{ok: boolean, result: string, parsed: object|null, costUsd: number|null, denials: Array, error: string|null}>}
 */
export function runClaude(options) {
  const {
    cwd,
    prompt,
    systemPrompt = null,
    jsonSchema = null,
    model = process.env.PM_CLAUDE_MODEL || 'sonnet',
    budgetUsd = Number(process.env.PM_CLAUDE_BUDGET_USD) || DEFAULT_BUDGET_USD,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    command = process.env.PM_CLAUDE_BIN || 'claude',
  } = options;

  const args = [
    '-p',
    '--output-format',
    'json',
    '--allowedTools',
    READ_ONLY_TOOLS,
    '--disallowedTools',
    DENIED_TOOLS,
    '--no-session-persistence',
    '--model',
    model,
    '--max-budget-usd',
    String(budgetUsd),
  ];

  if (systemPrompt) args.push('--append-system-prompt', systemPrompt);
  if (jsonSchema) args.push('--json-schema', JSON.stringify(jsonSchema));
  args.push(prompt);

  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      resolve({ ok: false, result: '', parsed: null, costUsd: null, denials: [], error: error.message });
      return;
    }

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      resolve({
        ok: false,
        result: '',
        parsed: null,
        costUsd: null,
        denials: [],
        error: `Timed out after ${Math.round(timeoutMs / 1000)}s`,
      });
    }, timeoutMs);

    child.stdout.on('data', (d) => {
      stdout += d;
    });
    child.stderr.on('data', (d) => {
      stderr += d;
    });

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const missing = error.code === 'ENOENT';
      resolve({
        ok: false,
        result: '',
        parsed: null,
        costUsd: null,
        denials: [],
        error: missing
          ? `The \`claude\` CLI was not found. Install Claude Code on this machine, or set PM_CLAUDE_BIN.`
          : error.message,
      });
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      let envelope;
      try {
        envelope = JSON.parse(stdout);
      } catch {
        resolve({
          ok: false,
          result: '',
          parsed: null,
          costUsd: null,
          denials: [],
          error: `Could not parse the reply (exit ${code}). ${stderr.trim().slice(0, 300)}`,
        });
        return;
      }

      const text = typeof envelope.result === 'string' ? envelope.result : '';
      let parsed = null;
      if (jsonSchema && text) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = null;
        }
      }

      // An empty error is almost always the budget cap biting on a cold prompt
      // cache. Say that, rather than "the model reported an error".
      const suspectBudget = envelope.is_error === true && !text && budgetUsd < BUDGET_FLOOR_USD;

      resolve({
        ok: envelope.is_error !== true && code === 0,
        result: text,
        parsed,
        costUsd: typeof envelope.total_cost_usd === 'number' ? envelope.total_cost_usd : null,
        // If it is trying to write, that is worth knowing about even though it failed.
        denials: envelope.permission_denials ?? [],
        error:
          envelope.is_error === true
            ? text ||
              (suspectBudget
                ? `Stopped at the $${budgetUsd} cap. A single question costs up to about $0.25 when the prompt cache is cold — raise PM_CLAUDE_BUDGET_USD to at least ${BUDGET_FLOOR_USD}.`
                : 'The model reported an error')
            : null,
      });
    });
  });
}

/**
 * Answer a question about one project.
 *
 * @param {string} projectCode
 * @param {string} question
 */
export async function askLedger(projectCode, question, options = {}) {
  const cwd = projectPaths(projectCode).root;

  const result = await runClaude({
    cwd,
    prompt: question,
    systemPrompt: LEDGER_SYSTEM_PROMPT,
    ...options,
  });

  if (result.denials.length > 0) {
    console.warn(
      `[ask] ${projectCode}: ${result.denials.length} tool call(s) denied - the model attempted something outside read-only.`,
    );
  }
  if (result.costUsd !== null) {
    console.log(`[ask] ${projectCode}: $${result.costUsd.toFixed(4)}`);
  }

  return result;
}
