/**
 * Assemble the weekly client report.
 *
 * Page 1 is the whole story: where the project stands, whether the date moved, and
 * what is needed from the reader. Appendices attach only when they have content -
 * a week with nothing to report should be one page. Fixed-structure reports that
 * pad empty sections train the reader to skim.
 */

import { formatHuman, dayOf } from '../../util/dates.js';
import { hasValue } from '../model.js';
import { fontFaceCss } from './fonts.js';
import { stylesheet } from './css.js';
import { sCurveSvg, sCurveLegend, progressMeter } from './charts.js';
import { embedImage } from './brand.js';
import {
  esc,
  section,
  empty,
  pill,
  callout,
  figure,
  stripCell,
  table,
  floatCell,
  dueCell,
} from './components.js';

const RESPONSIBILITY_LABEL = {
  employer: 'Employer / consultant',
  contractor: 'Contractor / supplier',
  neutral: 'Neutral',
  unclassified: 'Not yet classified',
};

// --- page 1 ----------------------------------------------------------------

function letterhead(model, brand) {
  const logo = brand.logoDataUri
    ? `<img src="${brand.logoDataUri}" alt="${esc(brand.company.name)}"/>`
    : '';

  // Row 1 on white - a client logo of any colour survives. The band beneath is
  // the brand itself: charcoal, bone type, one yellow rule.
  return `
  <div class="masthead-top">
    <div class="mark">
      ${logo}
      <div>
        <div class="company">${esc(brand.company.name)}</div>
        ${brand.company.descriptor ? `<div class="descriptor">${esc(brand.company.descriptor)}</div>` : ''}
      </div>
    </div>
    <div class="doctype">
      <div class="kind">Weekly Progress Report</div>
      <div class="no">No. ${esc(model.meta.reportNo)} &middot; Week ending ${esc(formatHuman(model.meta.weekEnding))}</div>
      ${brand.issuer.name ? `<div class="no">Issued by ${esc(brand.issuer.name)}${brand.issuer.title ? `, ${esc(brand.issuer.title)}` : ''}</div>` : ''}
    </div>
  </div>
  <div class="band">
    <div class="name">${esc(model.meta.name)}</div>
    <div class="meta">
      <span class="code">${esc(model.meta.code)}</span><br/>
      Programme data date ${esc(formatHuman(model.meta.dataDate))}
    </div>
  </div>
  <div class="band-accent"></div>`;
}

function headline(model, brand) {
  const c = brand.colours;
  const kpi = model.kpis;

  const movement = kpi.completion.movementDays;
  // Worded, not arrowed: the geometric arrows are outside the Latin subset of the
  // embedded font and would silently fall back to a different typeface. The words
  // also survive a greyscale print, where the colour alone would not.
  const deltaText =
    movement === null
      ? null
      : movement === 0
        ? 'No movement this week'
        : `${Math.abs(movement)} days ${movement > 0 ? 'later' : 'earlier'} than last week`;
  const deltaTone = movement === null || movement === 0 ? c.muted : movement > 0 ? c.red : c.green;

  const variance = kpi.completion.varianceDays;
  const sub =
    variance === null
      ? 'No contract completion date set'
      : variance > 0
        ? `${variance} days beyond contract completion (${formatHuman(kpi.completion.contractDate)})`
        : variance === 0
          ? `On the contract completion date (${formatHuman(kpi.completion.contractDate)})`
          : `${Math.abs(variance)} days inside contract completion (${formatHuman(kpi.completion.contractDate)})`;

  const progressCell = hasValue(model.kpis.progress.actual)
    ? stripCell({
        label: 'Progress',
        raw: `${model.kpis.progress.actual.value}%`,
        sub: hasValue(model.kpis.progress.planned)
          ? `${progressMeter({ actual: model.kpis.progress.actual.value, planned: model.kpis.progress.planned.value }, c)}
             <div style="margin-top:0.8mm">Plan ${model.kpis.progress.planned.value}% &middot; ${model.kpis.progress.variance.value > 0 ? '+' : ''}${model.kpis.progress.variance.value ?? '—'} pts</div>`
          : 'No baseline to compare against',
      })
    : stripCell({
        label: 'Progress',
        raw: figure(model.kpis.progress.actual),
      });

  return `
  <div class="strip">
    ${stripCell({
      lead: true,
      label: 'Forecast completion',
      raw: esc(formatHuman(kpi.completion.date)),
      delta: deltaText,
      deltaTone,
      sub: esc(sub),
    })}
    ${progressCell}
    ${stripCell({
      label: 'Status',
      raw: pill(model.status.rag, model.status.label),
      sub: esc(model.status.basis),
    })}
    ${stripCell({
      label: 'Decisions needed',
      raw: String(kpi.decisions.open),
      sub: kpi.decisions.overdue > 0
        ? `<span style="color:${c.red};font-weight:600">${kpi.decisions.overdue} overdue</span>`
        : 'None overdue',
    })}
  </div>`;
}

/**
 * Capped at five. A change log of everything that moved is a diff, not a report -
 * the reader needs the handful that change what they should do. The completion
 * movement is always first, so the cap only ever drops the tail.
 */
const MAX_MOVEMENTS = 5;

function movements(model) {
  if (model.movements.length === 0) return empty('No programme comparison available.');

  const shown = model.movements.slice(0, MAX_MOVEMENTS);
  const hidden = model.movements.length - shown.length;

  const items = shown
    .map(
      (m) =>
        `<li class="${m.emphasis ? 'emphasis' : ''}${m.flag ? ' flag' : ''}">${esc(m.text)}</li>`,
    )
    .join('');

  const more = hidden
    ? `<li class="muted">${hidden} further programme change${hidden === 1 ? '' : 's'} — see the full change report.</li>`
    : '';

  return `<ul class="movements">${items}${more}</ul>`;
}

function progressChart(model, brand) {
  const svg = sCurveSvg(model.sCurve, {
    dataDate: model.meta.dataDate,
    contractDate: model.kpis.completion.contractDate,
    colours: brand.colours,
  });
  const legend = sCurveLegend(brand.colours, {
    hasPlanned: model.sCurve.planned.length > 1,
    hasActual: model.sCurve.actual.length > 0,
  });
  return `<div class="chart">${svg}</div>${legend}`;
}

function criticalPath(model, brand) {
  const rows = model.criticalPath.map((activity) => ({
    activity: `<span class="strong">${esc(activity.code)}</span><div class="tight muted">${esc(activity.name ?? '')}</div>`,
    finish: esc(formatHuman(activity.planFinish)),
    float: floatCell(activity.floatDays, brand.colours),
  }));

  // Explicit widths: the table sits in a narrow column, and without them the
  // intrinsic width of an activity name pushes the Float column off the page.
  return table(
    [
      { key: 'activity', label: 'Driving activity', width: '52%' },
      { key: 'finish', label: 'Finish', width: '30%' },
      { key: 'float', label: 'Float', align: 'right', width: '18%' },
    ],
    rows,
    { emptyMessage: 'No incomplete critical activities in the current programme.' },
  );
}

/**
 * The section most reports omit, and the one that separates a project manager from
 * a reporter. Always rendered, even when empty.
 */
function decisions(model, brand) {
  const rows = model.decisions.slice(0, 6).map((decision) => ({
    subject: `<span class="strong">${esc(decision.subject)}</span>${decision.activity ? `<div class="tight muted">Affects ${esc(decision.activity)}</div>` : ''}`,
    owner: esc(decision.owner),
    due: dueCell(decision.due, decision.daysRemaining, brand.colours),
    consequence: decision.consequence
      ? esc(decision.consequence)
      : '<span class="muted">Not recorded</span>',
  }));

  return table(
    [
      { key: 'subject', label: 'Decision required', width: '32%' },
      { key: 'owner', label: 'From', width: '16%' },
      { key: 'due', label: 'By', width: '18%' },
      { key: 'consequence', label: 'If late' },
    ],
    rows,
    { emptyMessage: 'No decisions outstanding from you this week.' },
  );
}

function risks(model) {
  const rows = model.risks.slice(0, 3).map((risk) => ({
    subject: `<span class="strong">${esc(risk.subject)}</span>`,
    owner: esc(risk.owner),
    impact: risk.impact ? esc(risk.impact) : '<span class="muted">Not stated</span>',
    mitigation: risk.mitigation ? esc(risk.mitigation) : '<span class="muted">None recorded</span>',
  }));

  return table(
    [
      { key: 'subject', label: 'Risk', width: '30%' },
      { key: 'owner', label: 'Owner', width: '15%' },
      { key: 'impact', label: 'Impact', width: '20%' },
      { key: 'mitigation', label: 'Mitigation in train' },
    ],
    rows,
    { emptyMessage: 'No open risks recorded in the register.' },
  );
}

/**
 * Where every figure came from. A client who can see the basis can trust the
 * numbers; one who cannot, cannot.
 */
function provenance(model, brand) {
  const notes = [];

  notes.push(
    `Progress is reported as recorded in the programme update dated ${formatHuman(model.meta.dataDate)}, weighted by ${model.kpis.progress.weightBasis ?? 'activity duration'}.`,
  );

  if (hasValue(model.kpis.progress.planned)) {
    notes.push(`Planned progress is straight-line within each baseline activity.`);
  }

  // The basis on which the client is being reported to. A report that states the
  // contract it is measured against is answerable; one that does not invites the
  // argument about which dates were being used.
  const contract = model.meta.contract ?? {};
  const basis = [
    contract.form ? `Reported under ${contract.form}` : null,
    model.kpis.completion.contractDate
      ? `against a contract completion date of ${formatHuman(model.kpis.completion.contractDate)}`
      : null,
  ]
    .filter(Boolean)
    .join(' ');
  if (basis) notes.push(`${basis}.`);

  const periods = [
    contract.rfiResponseDays ? `RFIs ${contract.rfiResponseDays} days` : null,
    contract.submittalResponseDays ? `submittals ${contract.submittalResponseDays} days` : null,
    contract.delayNoticeDays ? `delay notices ${contract.delayNoticeDays} days` : null,
  ].filter(Boolean);
  if (periods.length) {
    notes.push(`Response periods applied throughout: ${periods.join(', ')}.`);
  }

  for (const warning of model.warnings) notes.push(warning);

  notes.push(
    'Figures shown as "Not measured" are not available in the project record. No value has been estimated in their place.',
  );

  if (brand.confidentiality) notes.push(brand.confidentiality);

  return `<div class="provenance">${notes.map((n) => esc(n)).join(' &middot; ')}</div>`;
}

// --- appendices ------------------------------------------------------------

function appendix(letter, title, subtitle, body) {
  return `
  <div class="appendix">
    <div class="appendix-eyebrow">Appendix ${letter}</div>
    <div class="appendix-title">${esc(title)}</div>
    ${subtitle ? `<div class="appendix-sub">${esc(subtitle)}</div>` : ''}
    <div class="rule"></div>
    <div style="margin-top:4mm">${body}</div>
  </div>`;
}

function lookaheadAppendix(lookahead, brand) {
  const c = brand.colours;

  const rows = lookahead.items.slice(0, 28).map((item) => {
    const state =
      item.state === 'blocked'
        ? pill('red', 'Blocked')
        : item.state === 'ready'
          ? pill('green', 'Ready')
          : pill('grey', 'Unverified');

    const detail = item.blockers.length
      ? item.blockers
          .map(
            (b) =>
              `<div class="tight" style="color:${c.red}">${esc(b.ref ?? b.register)} — ${esc(b.detail)}${b.owner ? ` (${esc(b.owner)})` : ''}${b.daysOpen !== null ? `, open ${b.daysOpen}d` : ''}</div>`,
          )
          .join('')
      : item.state === 'unverified'
        ? '<div class="tight muted">Registers are empty — readiness not verified</div>'
        : '';

    return {
      activity: `<span class="strong">${esc(item.code)}</span><div class="tight muted">${esc(item.name ?? '')}</div>${detail}`,
      start: esc(formatHuman(item.planStart)),
      float: floatCell(item.floatDays, c),
      state,
    };
  });

  const summary = `<div class="tight muted" style="margin-bottom:2.5mm">${lookahead.ready} ready &middot; ${lookahead.blocked} blocked${lookahead.unverified ? ` &middot; ${lookahead.unverified} unverified` : ''}. Ordered by float, tightest first.</div>`;

  return (
    summary +
    table(
      [
        { key: 'activity', label: 'Activity', width: '52%' },
        { key: 'start', label: 'Starts' },
        { key: 'float', label: 'Float', align: 'right' },
        { key: 'state', label: 'Readiness' },
      ],
      rows,
    )
  );
}

async function photosAppendix(photos) {
  const cells = [];

  for (const photo of photos.slice(0, 6)) {
    const dataUri = await embedImage(photo.absolutePath);
    if (!dataUri) continue;
    cells.push(`
      <div class="photo">
        <img src="${dataUri}" alt="${esc(photo.caption ?? 'Site photograph')}"/>
        <div class="caption">
          ${photo.activity ? `<span class="ref">${esc(photo.activity)}</span> &middot; ` : ''}${esc(formatHuman(photo.date))}
          ${photo.caption ? `<br/>${esc(photo.caption)}` : ''}
        </div>
      </div>`);
  }

  if (cells.length === 0) return empty('No photographs available for this period.');
  return `<div class="photos">${cells.join('')}</div>`;
}

function registersAppendix(registers, brand) {
  const c = brand.colours;

  const rows = Object.values(registers).map((register) => ({
    register: `<span class="strong">${esc(register.label)}</span>`,
    open: String(register.open),
    overdue:
      register.overdue > 0
        ? `<span style="color:${c.red};font-weight:600">${register.overdue}</span>`
        : '0',
    sla: register.responseDays ? `${register.responseDays} days` : '<span class="muted">—</span>',
    oldest:
      register.oldestOpenDays === null
        ? '<span class="muted">—</span>'
        : `${register.oldestOpenDays}d`,
  }));

  const overdueDetail = Object.values(registers)
    .flatMap((register) =>
      register.overdueEntries.map(
        (entry) =>
          `<div class="tight"><span class="strong">${esc(entry.ref ?? '')}</span> ${esc(entry.subject)} — with ${esc(entry.owner ?? 'unassigned')}, open ${entry.daysOpen}d against a ${register.responseDays}-day period</div>`,
      ),
    )
    .join('');

  return (
    table(
      [
        { key: 'register', label: 'Register' },
        { key: 'open', label: 'Open', align: 'right' },
        { key: 'overdue', label: 'Beyond period', align: 'right' },
        { key: 'sla', label: 'Response period', align: 'right' },
        { key: 'oldest', label: 'Oldest open', align: 'right' },
      ],
      rows,
    ) +
    (overdueDetail
      ? `<div style="margin-top:3mm">${callout('Items beyond the contractual response period', overdueDetail)}</div>`
      : '')
  );
}

/**
 * Procurement, with order-by dates derived from the programme rather than typed
 * out once and left to rot.
 */
function procurementAppendix(items, brand) {
  const c = brand.colours;

  const rows = items.map((item) => {
    const status = item.orphaned
      ? pill('grey', 'Unlinked')
      : item.daysToOrder === null
        ? pill('grey', 'No date')
        : item.daysToOrder < 0
          ? pill('red', `${Math.abs(item.daysToOrder)}d late`)
          : item.daysToOrder <= 14
            ? pill('amber', `${item.daysToOrder}d`)
            : pill('green', `${item.daysToOrder}d`);

    return {
      item: `<span class="strong">${esc(item.item)}</span>${item.supplier ? `<div class="tight muted">${esc(item.supplier)}</div>` : ''}`,
      activity: item.activity ? esc(item.activity) : '<span class="muted">—</span>',
      lead: item.leadDays === null ? '<span class="muted">not recorded</span>' : `${item.leadDays}d`,
      needOnSite: item.needOnSite ? esc(formatHuman(item.needOnSite)) : '<span class="muted">—</span>',
      orderBy: item.orderBy
        ? `<span class="strong">${esc(formatHuman(item.orderBy))}</span>`
        : '<span class="muted">cannot be derived</span>',
      status,
    };
  });

  const orphaned = items.filter((i) => i.orphaned);

  return (
    table(
      [
        { key: 'item', label: 'Item', width: '26%' },
        { key: 'activity', label: 'Activity', width: '12%' },
        { key: 'lead', label: 'Lead', align: 'right', width: '10%' },
        { key: 'needOnSite', label: 'Needed on site', width: '18%' },
        { key: 'orderBy', label: 'Order by', width: '18%' },
        { key: 'status', label: 'Float', width: '16%' },
      ],
      rows,
    ) +
    (orphaned.length > 0
      ? `<div style="margin-top:3mm">${callout(
          'Items no longer linked to the programme',
          orphaned
            .map(
              (i) =>
                `<div class="tight">${esc(i.ref)} ${esc(i.item)} — linked to ${esc(i.activity)}, which is not in the current programme.</div>`,
            )
            .join(''),
        )}</div>`
      : '') +
    `<div class="provenance">Order-by dates are derived from the linked activity's planned start in the current programme, less the recorded lead time. They move when the programme moves.</div>`
  );
}

function eventsAppendix(events, brand) {
  const rows = events.map((event) => ({
    ref: `<span class="strong">${esc(event.ref)}</span><div class="tight muted">${esc(formatHuman(event.date))}</div>`,
    activity: esc(event.activity ?? '—'),
    description: esc(event.description),
    responsibility: esc(RESPONSIBILITY_LABEL[event.responsibility] ?? event.responsibility),
    notice: event.noticeIssued
      ? pill('green', 'Issued')
      : event.noticeDeadline
        ? `<span style="color:${brand.colours.amber};font-weight:600">Due ${esc(formatHuman(event.noticeDeadline))}</span>`
        : '<span class="muted">—</span>',
  }));

  return (
    table(
      [
        { key: 'ref', label: 'Ref', width: '12%' },
        { key: 'activity', label: 'Activity', width: '12%' },
        { key: 'description', label: 'Event' },
        { key: 'responsibility', label: 'Responsibility', width: '17%' },
        { key: 'notice', label: 'Notice', width: '14%' },
      ],
      rows,
    ) +
    `<div class="provenance">Responsibility is shown exactly as recorded at the time the event was logged. Entries marked "Not yet classified" have not been determined, and nothing here should be read as an assertion of entitlement.</div>`
  );
}

function commercialAppendix(commercial) {
  const variations = commercial.variations;
  const rows = [
    {
      item: '<span class="strong">Variations raised</span>',
      value: String(variations.total),
    },
    {
      item: '<span class="strong">Variations open</span>',
      value: String(variations.open),
    },
    {
      item: '<span class="strong">Value of variations</span>',
      value: figure(variations.value),
    },
  ];

  return (
    table([{ key: 'item', label: 'Item' }, { key: 'value', label: 'Position', align: 'right' }], rows) +
    `<div class="provenance">Commercial figures are hand-entered pending a valuation layer, and are stated as at the date recorded against them.</div>`
  );
}

// --- document --------------------------------------------------------------

export async function renderWeeklyHtml(model, brand) {
  const { css: fontCss, missing } = await fontFaceCss();
  const c = brand.colours;

  const stale =
    model.meta.programmeAgeDays !== null && model.meta.programmeAgeDays > 10
      ? callout(
          'Basis of this report',
          `The programme was last recalculated ${esc(model.meta.programmeAgeDays)} days ago, on ${esc(formatHuman(model.meta.dataDate))}. Dates and float in this report are computed from that update.`,
        )
      : '';

  const appendices = [];
  const a = model.appendices;

  if (a.lookahead) {
    appendices.push(
      appendix(
        'A',
        'Three-week look-ahead',
        'Every activity marked ready or blocked, with the blocking item named.',
        lookaheadAppendix(a.lookahead, brand),
      ),
    );
  }

  if (a.photos) {
    appendices.push(
      appendix('B', 'Progress photographs', `Week ending ${formatHuman(model.meta.weekEnding)}.`, await photosAppendix(a.photos)),
    );
  }

  if (a.registers) {
    appendices.push(
      appendix(
        'C',
        'Registers',
        'Open items and turnaround against the contractual response period.',
        registersAppendix(a.registers, brand),
      ),
    );
  }

  if (a.procurement) {
    appendices.push(
      appendix(
        'D',
        'Procurement and long lead items',
        'Order-by dates derived from the current programme.',
        procurementAppendix(a.procurement, brand),
      ),
    );
  }

  if (a.events) {
    appendices.push(
      appendix('E', 'Delay events recorded this period', null, eventsAppendix(a.events, brand)),
    );
  }

  if (a.commercial) {
    appendices.push(appendix('F', 'Commercial position', null, commercialAppendix(a.commercial)));
  }

  const body = `
  <div class="page">
    ${letterhead(model, brand)}
    ${headline(model, brand)}
    ${stale ? `<div style="margin-top:5mm">${stale}</div>` : ''}
    ${section('What moved this week', movements(model), { index: '01' })}
    <div class="section">
      <div class="cols">
        <div class="col-60">
          <div class="eyebrow"><span class="index">02</span>Progress against plan</div>
          ${progressChart(model, brand)}
        </div>
        <div class="col-40">
          <div class="eyebrow"><span class="index">03</span>Critical path</div>
          ${criticalPath(model, brand)}
        </div>
      </div>
    </div>
    ${section('Decisions required from you', decisions(model, brand), { index: '04', count: model.decisions.length ? `${model.decisions.length} open` : '' })}
    ${section('Risks', risks(model), { index: '05' })}
    ${provenance(model, brand)}
  </div>
  ${appendices.join('')}`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${esc(brand.company.name)} — ${esc(model.meta.name)} — Weekly Progress Report No. ${esc(model.meta.reportNo)}</title>
<style>${stylesheet(brand, { fontCss })}</style>
</head>
<body>${body}</body>
</html>`;

  return { html, warnings: missing.length ? [`Fonts missing, report will use fallbacks: ${missing.join(', ')}`] : [] };
}

export const _internals = { letterhead, headline, decisions, provenance };
