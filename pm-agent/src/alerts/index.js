/**
 * Run the alert conditions against a project and decide what to say.
 *
 * Designed to be run by cron every morning. On a quiet day it sends nothing, which
 * is the point - the value of an alert is destroyed by the ones that did not need
 * sending.
 */

import { projectPaths } from '../ledger/paths.js';
import { readYaml } from '../ledger/store.js';
import { commitLedger } from '../ledger/git.js';
import { loadLatestProgramme, loadLastTwoProgrammes } from '../programme/ingest.js';
import { evaluateAlerts } from './rules.js';
import { loadAlertState, saveAlertState, reconcile } from './state.js';
import { today, formatHuman } from '../util/dates.js';

const SEVERITY_MARK = { critical: '🔴', high: '🟠', medium: '🟡' };

/**
 * @param {string} projectCode
 * @param {{asOf?: string, commit?: boolean}} options
 */
export async function runAlerts(projectCode, options = {}) {
  const asOf = options.asOf ?? today();
  const paths = projectPaths(projectCode);

  const latest = await loadLatestProgramme(projectCode);
  const pair = await loadLastTwoProgrammes(projectCode);

  const candidates = evaluateAlerts({
    asOf,
    config: (await readYaml(paths.config)) ?? {},
    programme: latest?.programme ?? null,
    previousProgramme: pair?.previous.programme ?? null,
    events: await readYaml(paths.events),
    decisions: await readYaml(paths.decisions),
    actions: await readYaml(paths.actions),
    rfi: await readYaml(paths.rfi),
    submittals: await readYaml(paths.submittals),
    procurement: await readYaml(paths.procurement),
  });

  const previousState = await loadAlertState(projectCode);
  const { state, toSend, resolved, open } = reconcile(candidates, previousState, { asOf });

  const file = await saveAlertState(projectCode, state);

  let sha = null;
  if (options.commit !== false && (toSend.length > 0 || resolved.length > 0)) {
    sha = await commitLedger(
      [file],
      `alerts(${projectCode}): ${toSend.length} raised, ${resolved.length} cleared on ${asOf}`,
    );
  }

  return { asOf, candidates, toSend, resolved, open, state, file, sha };
}

/** One alert, formatted for Telegram. */
export function formatAlert(alert) {
  const mark = SEVERITY_MARK[alert.severity] ?? '•';
  const escalated = alert.reason === 'escalated' ? ' _(escalated)_' : '';
  return `${mark} *${alert.title}*${escalated}\n${alert.detail}`;
}

/** The whole batch, as one message. Empty string when there is nothing to say. */
export function formatAlertBatch(projectCode, alerts, { asOf } = {}) {
  if (alerts.length === 0) return '';

  const lines = [`*${projectCode}* — ${alerts.length} alert${alerts.length === 1 ? '' : 's'}`];
  if (asOf) lines.push(`_${formatHuman(asOf)}_`);
  lines.push('');
  lines.push(alerts.map(formatAlert).join('\n\n'));

  // Never let an alert be the last word on a contractual deadline.
  if (alerts.some((a) => a.condition === 'notice')) {
    lines.push('');
    lines.push('_Check the clause before issuing any notice. I draft; you send._');
  }

  return lines.join('\n');
}

/** On-demand listing, including the quiet ones that were not re-sent. */
export function formatOpenAlerts(projectCode, open, { asOf } = {}) {
  if (open.length === 0) {
    return `*${projectCode}* — no open alerts${asOf ? ` as at ${formatHuman(asOf)}` : ''}.`;
  }

  const order = { critical: 0, high: 1, medium: 2 };
  const sorted = [...open].sort(
    (a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3) || (a.due ?? '9999').localeCompare(b.due ?? '9999'),
  );

  const lines = [`*${projectCode}* — ${open.length} open alert${open.length === 1 ? '' : 's'}`, ''];

  for (const entry of sorted) {
    const mark = SEVERITY_MARK[entry.severity] ?? '•';
    const since = entry.firstSeen ? ` · first flagged ${formatHuman(entry.firstSeen)}` : '';
    lines.push(`${mark} *${entry.title}*${since}`);
    lines.push(entry.detail);
    lines.push('');
  }

  return lines.join('\n').trim();
}
