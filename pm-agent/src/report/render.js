/**
 * Markdown renderers.
 *
 * Markdown because it reads fine in a terminal, pastes into an email, renders
 * in Telegram with light massaging, and converts to PDF/DOCX when a client
 * wants a formal issue.
 */

import { formatHuman, dayOf } from '../util/dates.js';

const sign = (n) => (n > 0 ? `+${n}` : `${n}`);
const tick = (ok) => (ok ? 'PASS' : 'FAIL');

function table(headers, rows) {
  if (rows.length === 0) return '_None._\n';
  const head = `| ${headers.join(' | ')} |`;
  const rule = `|${headers.map(() => '---').join('|')}|`;
  const body = rows.map((r) => `| ${r.join(' | ')} |`).join('\n');
  return `${head}\n${rule}\n${body}\n`;
}

export function renderDiff(diff, { limit = 25 } = {}) {
  const lines = [];

  lines.push(`# Programme change report`);
  lines.push('');
  lines.push(
    `**${diff.from.dataDate} → ${diff.to.dataDate}**  ·  ${diff.from.activityCount} → ${diff.to.activityCount} activities`,
  );
  lines.push('');

  if (diff.completionShiftDays !== null && diff.completionShiftDays !== 0) {
    const direction = diff.completionShiftDays > 0 ? 'LATER' : 'EARLIER';
    lines.push(
      `> **Forecast completion moved ${Math.abs(diff.completionShiftDays)} days ${direction}** — ${formatHuman(diff.from.forecastFinish)} → ${formatHuman(diff.to.forecastFinish)}`,
    );
  } else {
    lines.push(`> Forecast completion unchanged at ${formatHuman(diff.to.forecastFinish)}`);
  }
  lines.push('');

  lines.push('## Red flags');
  lines.push('');
  if (diff.redFlags.length === 0) {
    lines.push('None. The revision is arithmetically clean.');
  } else {
    for (const flag of diff.redFlags) lines.push(`- ${flag}`);
  }
  lines.push('');

  lines.push('## Summary');
  lines.push('');
  const s = diff.summary;
  lines.push(
    table(
      ['Change', 'Count'],
      [
        ['Activities added', s.added],
        ['Activities removed', s.removed],
        ['Date changes', s.dateChanges],
        ['Duration changes', `${s.durationChanges} (${s.unsupportedDurationCuts} unsupported cuts)`],
        ['Float changes', `${s.floatChanges} (${s.floatWentNegative} went negative)`],
        ['Constraint changes', `${s.constraintChanges} (${s.hardConstraintsAdded} hard added)`],
        ['Logic links added', s.logicAdded],
        ['Logic links removed', s.logicRemoved],
        ['Logic links changed', s.logicChanged],
        ['Criticality changes', s.criticalityChanges],
      ],
    ),
  );

  if (diff.logic.removed.length > 0) {
    lines.push('## Logic removed');
    lines.push('');
    lines.push('Removed links are the least visible and most consequential change type.');
    lines.push('');
    lines.push(
      table(
        ['Link', 'Was'],
        diff.logic.removed.slice(0, limit).map((l) => [`\`${l.link}\``, `${l.type}${l.lagDays ? ` +${l.lagDays}d` : ''}`]),
      ),
    );
  }

  if (diff.logic.changed.length > 0) {
    lines.push('## Logic changed');
    lines.push('');
    lines.push(
      table(
        ['Link', 'From', 'To'],
        diff.logic.changed
          .slice(0, limit)
          .map((l) => [
            `\`${l.link}\``,
            `${l.from.type}${l.from.lagDays ? ` +${l.from.lagDays}d` : ''}`,
            `${l.to.type}${l.to.lagDays ? ` +${l.to.lagDays}d` : ''}`,
          ]),
      ),
    );
  }

  const unsupported = diff.durationChanges.filter((d) => d.unsupported);
  if (unsupported.length > 0) {
    lines.push('## Durations cut without progress');
    lines.push('');
    lines.push(
      table(
        ['Activity', 'From', 'To', '% complete'],
        unsupported
          .slice(0, limit)
          .map((d) => [`${d.code} ${d.name ?? ''}`, `${d.fromDays}d`, `${d.toDays}d`, `${d.percentComplete}%`]),
      ),
    );
  }

  if (diff.dateChanges.length > 0) {
    lines.push('## Largest date movements');
    lines.push('');
    lines.push(
      table(
        ['Activity', 'Finish was', 'Finish now', 'Shift', 'Critical'],
        diff.dateChanges
          .slice(0, limit)
          .map((d) => [
            `${d.code} ${d.name ?? ''}`,
            d.from.finish ?? '-',
            d.to.finish ?? '-',
            d.finishShiftDays === null ? '-' : `${sign(d.finishShiftDays)}d`,
            d.critical ? 'yes' : '',
          ]),
      ),
    );
  }

  const removedIncomplete = diff.removed.filter((a) => !a.wasComplete);
  if (removedIncomplete.length > 0) {
    lines.push('## Incomplete activities deleted');
    lines.push('');
    lines.push(
      table(
        ['Activity', 'Was planned', 'Was critical'],
        removedIncomplete
          .slice(0, limit)
          .map((a) => [
            `${a.code} ${a.name ?? ''}`,
            `${dayOf(a.planStart) ?? '-'} → ${dayOf(a.planFinish) ?? '-'}`,
            a.wasCritical ? 'yes' : '',
          ]),
      ),
    );
  }

  const constraintsAdded = diff.constraintChanges.filter((c) => c.hardConstraintAdded);
  if (constraintsAdded.length > 0) {
    lines.push('## Hard constraints added');
    lines.push('');
    lines.push(
      table(
        ['Activity', 'Constraint', 'Date'],
        constraintsAdded.slice(0, limit).map((c) => [`${c.code} ${c.name ?? ''}`, c.to.type ?? '-', c.to.date ?? '-']),
      ),
    );
  }

  return lines.join('\n');
}

export function renderExceptions(result, { projectCode } = {}) {
  const lines = [];
  lines.push(`# Chase list${projectCode ? ` — ${projectCode}` : ''}`);
  lines.push('');
  lines.push(`As of **${result.asOf}** · programme data date **${result.dataDate}**`);

  if (result.programmeAgeDays !== null && result.programmeAgeDays > 7) {
    lines.push('');
    lines.push(
      `> **The programme is ${result.programmeAgeDays} days old.** Every question below is being asked against stale data — re-export from P6 before trusting it.`,
    );
  }

  lines.push('');
  lines.push(
    `${result.total} exceptions found${result.suppressed ? `, ${result.suppressed} already answered today` : ''}.`,
  );
  lines.push('');

  lines.push(
    table(
      ['Priority', 'Activity', 'Issue', 'Float', 'Question'],
      result.questions.map((q, i) => [
        String(i + 1),
        `${q.code} ${q.name ?? ''}`,
        q.kind,
        q.totalFloatDays === null ? '-' : `${q.totalFloatDays}d`,
        q.question.replace(/\*/g, ''),
      ]),
    ),
  );

  if (result.remaining > 0) {
    lines.push('');
    lines.push(`_${result.remaining} further exceptions not shown — capped to keep the session answerable._`);
  }

  return lines.join('\n');
}

export function renderHealth(health) {
  const lines = [];
  lines.push(`# Schedule health check (DCMA 14-point)`);
  lines.push('');
  lines.push(`Project **${health.project ?? '-'}** · data date **${health.dataDate ?? '-'}** · ${health.activityCount} activities, ${health.relationshipCount} links`);
  lines.push('');
  lines.push(`**${health.verdict}**`);
  lines.push('');

  lines.push(
    table(
      ['Check', 'Result', 'Count', '%', 'Limit'],
      health.checks.map((c) => [
        c.name,
        tick(c.passed),
        String(c.count),
        `${c.percent}%`,
        c.threshold === 0 ? '0' : `${c.threshold}%`,
      ]),
    ),
  );

  const failures = health.checks.filter((c) => !c.passed && c.examples.length > 0);
  if (failures.length > 0) {
    lines.push('## Failures in detail');
    lines.push('');
    for (const c of failures) {
      lines.push(`### ${c.name}`);
      if (c.note) lines.push(`_${c.note}_`);
      lines.push('');
      for (const example of c.examples) lines.push(`- ${example}`);
      if (c.count > c.examples.length) lines.push(`- _…and ${c.count - c.examples.length} more_`);
      lines.push('');
    }
  }

  lines.push('## Not assessed automatically');
  lines.push('');
  for (const item of health.notAssessed) {
    lines.push(`- **${item.name}** — ${item.note ?? 'Requires manual run.'}`);
  }

  return lines.join('\n');
}
