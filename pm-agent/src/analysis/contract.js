/**
 * The project read against its own contract.
 *
 * Everything else in this system measures the works against the programme. This
 * measures both against the agreement: where the completion date has gone
 * relative to the one that was signed, what that costs per day, which notice
 * periods are running, and which of the other side's obligations have been
 * missed - because that last one is the contractor's evidence, and it is worth
 * nothing if it is noticed for the first time at the final account.
 *
 * Three rules govern this file.
 *
 * It never infers entitlement. Delay damages exposure is arithmetic on a
 * recorded forecast date and a recorded rate, stated as what is at stake *if*
 * the overrun is not excused. Whether it is excused is a human's answer,
 * recorded against the event, and nothing here reads it as settled.
 *
 * It never invents a term. A clause is cited only where a clause number was
 * configured; a period is applied only where a period was configured. What is
 * not configured is reported as not watched, by name, so that silence is never
 * mistaken for safety.
 *
 * It never rounds in our favour. Days are whole calendar days and the cap is
 * applied as written.
 */

import { daysBetween, addDays, dayOf, formatHuman } from '../util/dates.js';
import { entriesOf, isOpen, raisedOn, subjectOf, ownerOf } from '../ledger/registers.js';

/**
 * The terms this reads, and what each one is for.
 *
 * `label` is what the user sees when it is missing, phrased as the thing that
 * stops working rather than as a field name - "no delay damages rate, so
 * exposure cannot be stated" beats "ldPerDay is null".
 */
export const CONTRACT_TERMS = [
  { key: 'form', label: 'contract form', purpose: 'every citation and letter states the form' },
  { key: 'sum', label: 'contract sum', purpose: 'the delay damages cap is a percentage of it' },
  { key: 'completionDate', label: 'contract completion date', purpose: 'nothing can be measured as late without it' },
  { key: 'ldPerDay', label: 'delay damages rate', purpose: 'exposure per day of overrun' },
  { key: 'ldCapPercent', label: 'delay damages cap', purpose: 'the ceiling on that exposure' },
  { key: 'delayNoticeDays', label: 'delay notice period', purpose: 'the time bar on every delay event' },
  { key: 'particularsDays', label: 'particulars period', purpose: 'the second time bar, after a notice is given' },
  { key: 'rfiResponseDays', label: 'RFI response period', purpose: 'a late answer is evidence of late information' },
  { key: 'submittalResponseDays', label: 'submittal response period', purpose: 'the same, for approvals' },
];

const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/** Format money without pretending to a precision the ledger does not have. */
export function formatMoney(amount, currency = 'USD') {
  if (amount === null || amount === undefined) return null;
  return `${currency} ${Math.round(amount).toLocaleString('en-US')}`;
}

/**
 * Delay damages exposure at the current forecast.
 *
 * Deliberately not called "liability". It is the sum the contract puts at stake
 * for the overrun as currently forecast, before any extension of time. Whether
 * any of it is actually owed depends on responsibility for each delay event -
 * which is recorded by a human, event by event, and never derived here.
 *
 * @returns {{days, perDay, gross, cap, capped, amount, currency, contractDate, forecastDate}|null}
 */
export function delayDamagesExposure({ contract, forecastFinish }) {
  const contractDate = dayOf(contract?.completionDate);
  const forecastDate = dayOf(forecastFinish);
  const perDay = num(contract?.ldPerDay);
  if (!contractDate || !forecastDate) return null;

  const days = daysBetween(contractDate, forecastDate);
  if (days <= 0) return { days, perDay, gross: 0, cap: null, capped: false, amount: 0, currency: contract?.currency ?? 'USD', contractDate, forecastDate };
  if (perDay === null) return null;

  const gross = days * perDay;
  const sum = num(contract?.sum);
  const capPercent = num(contract?.ldCapPercent);
  const cap = sum !== null && capPercent !== null ? (sum * capPercent) / 100 : null;

  return {
    days,
    perDay,
    gross,
    cap,
    capped: cap !== null && gross > cap,
    amount: cap !== null ? Math.min(gross, cap) : gross,
    currency: contract?.currency ?? 'USD',
    contractDate,
    forecastDate,
  };
}

/** A clause citation, only ever where one was configured. */
const cite = (clause) => (clause ? ` (${clause})` : '');

/**
 * Delay events whose notice period is running or has run out.
 *
 * Responsibility is read, never decided: an event a human recorded as ours is
 * not a notice we would serve, so it is left alone.
 */
function noticeExposures({ contract, events, asOf }) {
  const period = num(contract?.delayNoticeDays);
  if (period === null) return [];

  const out = [];

  for (const event of entriesOf(events)) {
    if (!isOpen(event)) continue;
    // Only the other side's, and the not-yet-classified - never our own.
    if (event.responsibility === 'contractor') continue;
    if (event.noticeGiven) continue;

    const raised = raisedOn(event) ?? event.date;
    if (!raised) continue;

    const deadline = dayOf(event.noticeDeadline) ?? addDays(raised, period);
    const left = daysBetween(asOf, deadline);

    out.push({
      key: `notice:${event.ref}`,
      kind: 'notice',
      severity: left < 0 ? 'critical' : left <= 3 ? 'high' : 'medium',
      title: left < 0 ? `Notice period expired — ${event.ref}` : `Notice due in ${left}d — ${event.ref}`,
      detail:
        `${subjectOf(event)}\n` +
        (left < 0
          ? `The ${period}-day period${cite(contract?.delayNoticeClause)} ran out on ${formatHuman(deadline)}. ` +
            'Late notice is the usual ground for rejecting an otherwise good claim.'
          : `${period} days from ${formatHuman(raised)}${cite(contract?.delayNoticeClause)} — due ${formatHuman(deadline)}.`),
      ref: event.ref,
      due: deadline,
    });
  }

  return out;
}

/** The second time bar: particulars after a notice has been served. */
function particularsExposures({ contract, events, asOf }) {
  const period = num(contract?.particularsDays);
  if (period === null) return [];

  const out = [];

  for (const event of entriesOf(events)) {
    if (!isOpen(event) || !event.noticeGiven) continue;
    if (event.particularsGiven) continue;

    const given = dayOf(event.noticeGiven);
    if (!given) continue;

    const deadline = addDays(given, period);
    const left = daysBetween(asOf, deadline);
    if (left > 14) continue; // not yet worth saying

    out.push({
      key: `particulars:${event.ref}`,
      kind: 'particulars',
      severity: left < 0 ? 'critical' : 'high',
      title: left < 0 ? `Particulars overdue — ${event.ref}` : `Particulars due in ${left}d — ${event.ref}`,
      detail:
        `Notice was given on ${formatHuman(given)}. Full particulars are due within ` +
        `${period} days${cite(contract?.particularsClause)} — ${formatHuman(deadline)}.`,
      ref: event.ref,
      due: deadline,
    });
  }

  return out;
}

/**
 * The other side beyond its own response period.
 *
 * Framed as evidence rather than as a complaint, because that is what it is: a
 * contemporaneous record that the information was late is what supports an
 * extension of time months later.
 */
function lateInformationExposures({ contract, registers, asOf }) {
  const out = [];

  const checks = [
    { register: registers.rfi, days: num(contract?.rfiResponseDays), noun: 'RFI', clause: contract?.rfiClause },
    { register: registers.submittals, days: num(contract?.submittalResponseDays), noun: 'Submittal', clause: contract?.submittalClause },
  ];

  for (const check of checks) {
    if (check.days === null) continue;

    for (const entry of entriesOf(check.register)) {
      if (!isOpen(entry)) continue;
      const raised = raisedOn(entry);
      if (!raised) continue;

      const age = daysBetween(raised, asOf);
      if (age <= check.days) continue;

      out.push({
        key: `late-info:${entry.ref}`,
        kind: 'late-information',
        severity: age > check.days * 2 ? 'high' : 'medium',
        title: `${check.noun} ${entry.ref} — ${age - check.days}d beyond the contract period`,
        detail:
          `${subjectOf(entry)}\n` +
          `With ${ownerOf(entry) ?? 'the other side'} for ${age} days against a ${check.days}-day ` +
          `period${cite(check.clause)}. Recorded as evidence of late information.`,
        ref: entry.ref,
        due: addDays(raised, check.days),
      });
    }
  }

  return out;
}

/**
 * Everything the contract has to say about where this project stands today.
 *
 * @param {object} input {contract, programme, events, rfi, submittals, asOf}
 * @returns {{terms, missing, damages, exposures, watched: boolean}}
 */
export function contractPosition({ contract = {}, programme, events, rfi, submittals, asOf }) {
  const forecastFinish = programme?.stats?.forecastFinish ?? null;

  const missing = CONTRACT_TERMS.filter((term) => {
    const value = contract?.[term.key];
    return value === null || value === undefined || value === '';
  });

  const damages = delayDamagesExposure({ contract, forecastFinish });

  const exposures = [
    ...noticeExposures({ contract, events, asOf }),
    ...particularsExposures({ contract, events, asOf }),
    ...lateInformationExposures({ contract, registers: { rfi, submittals }, asOf }),
  ];

  if (damages && damages.days > 0) {
    exposures.unshift({
      key: 'ld-exposure',
      kind: 'damages',
      severity: 'critical',
      title: `${damages.days} days beyond contract completion`,
      detail:
        `Forecast ${formatHuman(damages.forecastDate)} against a contract date of ` +
        `${formatHuman(damages.contractDate)}. At ${formatMoney(damages.perDay, damages.currency)} per day` +
        `${cite(contract?.ldClause)} that is ${formatMoney(damages.amount, damages.currency)}` +
        `${damages.capped ? ` (capped at ${contract.ldCapPercent}% of the contract sum)` : ''} ` +
        'at stake if the overrun is not excused. Extensions of time already granted are not deducted here.',
      due: damages.contractDate,
    });
  }

  const order = { critical: 0, high: 1, medium: 2 };
  exposures.sort(
    (a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3) || String(a.due).localeCompare(String(b.due)),
  );

  return {
    terms: contract ?? {},
    missing,
    damages,
    exposures,
    // Whether the contract is doing any work at all. A project with no terms
    // configured is not being watched, however green it looks.
    watched: missing.length < CONTRACT_TERMS.length,
  };
}

/** The contract position, formatted for Telegram. */
export function formatContract(projectCode, position, { asOf } = {}) {
  const t = position.terms ?? {};
  const lines = [`*${projectCode}* — the contract I am working to`];
  if (asOf) lines.push(`_as at ${formatHuman(asOf)}_`);
  lines.push('');

  if (t.form) lines.push(`*Form* ${t.form}`);
  if (t.sum) lines.push(`*Sum* ${formatMoney(t.sum, t.currency ?? 'USD')}`);
  if (t.completionDate) lines.push(`*Completion* ${formatHuman(t.completionDate)}`);
  if (t.ldPerDay) {
    lines.push(
      `*Delay damages* ${formatMoney(t.ldPerDay, t.currency ?? 'USD')}/day` +
        (t.ldCapPercent ? `, capped at ${t.ldCapPercent}%` : ''),
    );
  }
  if (t.retentionPercent) lines.push(`*Retention* ${t.retentionPercent}%`);

  const periods = [
    t.delayNoticeDays ? `delay notice ${t.delayNoticeDays}d` : null,
    t.particularsDays ? `particulars ${t.particularsDays}d` : null,
    t.rfiResponseDays ? `RFI ${t.rfiResponseDays}d` : null,
    t.submittalResponseDays ? `submittals ${t.submittalResponseDays}d` : null,
  ].filter(Boolean);
  if (periods.length) lines.push(`*Periods* ${periods.join(' · ')}`);

  lines.push('');

  if (position.exposures.length === 0) {
    lines.push('Nothing in the contract is running against you today.');
  } else {
    lines.push(`*Where you are exposed* — ${position.exposures.length}`);
    lines.push('');
    const mark = { critical: '🔴', high: '🟠', medium: '🟡' };
    for (const item of position.exposures.slice(0, 8)) {
      lines.push(`${mark[item.severity] ?? '•'} *${item.title}*`);
      lines.push(item.detail);
      lines.push('');
    }
  }

  // The honest part. What is not set is not watched, and that has to be visible.
  if (position.missing.length > 0) {
    lines.push(`_Not set, so not watched: ${position.missing.map((m) => m.label).join(', ')}._`);
    lines.push('_Add them to `project.yaml` in the project folder._');
  }

  return lines.join('\n').trim();
}
