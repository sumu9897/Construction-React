#!/usr/bin/env node
/**
 * A stand-in for the `claude` CLI, so the suite exercises the runner without
 * network access or cost.
 *
 * Behaviour is driven by env vars set by the test:
 *   FAKE_CLAUDE_RESULT   the text to return as `.result`
 *   FAKE_CLAUDE_ERROR    when set, returns is_error: true
 *   FAKE_CLAUDE_EXIT     process exit code (default 0)
 *   FAKE_CLAUDE_GARBAGE  emit non-JSON, to exercise the parse-failure path
 *   FAKE_CLAUDE_HANG     sleep forever, to exercise the timeout
 *   FAKE_CLAUDE_DENIALS  number of permission denials to report
 *   FAKE_CLAUDE_ARGS_OUT file to write the received argv to, for assertions
 */

import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);

if (process.env.FAKE_CLAUDE_ARGS_OUT) {
  writeFileSync(process.env.FAKE_CLAUDE_ARGS_OUT, JSON.stringify(args), 'utf8');
}

if (process.env.FAKE_CLAUDE_HANG) {
  setInterval(() => {}, 1000);
} else if (process.env.FAKE_CLAUDE_GARBAGE) {
  process.stdout.write('not json at all');
  process.exit(Number(process.env.FAKE_CLAUDE_EXIT ?? 0));
} else {
  const denials = Number(process.env.FAKE_CLAUDE_DENIALS ?? 0);

  process.stdout.write(
    JSON.stringify({
      type: 'result',
      subtype: process.env.FAKE_CLAUDE_ERROR ? 'error' : 'success',
      is_error: Boolean(process.env.FAKE_CLAUDE_ERROR),
      result: process.env.FAKE_CLAUDE_ERROR ?? process.env.FAKE_CLAUDE_RESULT ?? 'ok',
      session_id: '00000000-0000-0000-0000-000000000000',
      total_cost_usd: 0.0123,
      permission_denials: Array.from({ length: denials }, (_, i) => ({
        tool_name: 'Write',
        tool_input: { file_path: `/tmp/denied-${i}` },
      })),
    }),
  );
  process.exit(Number(process.env.FAKE_CLAUDE_EXIT ?? 0));
}
