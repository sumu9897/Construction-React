/**
 * Inline SVG charts. No chart library - these are deterministic, self-contained,
 * and print at any size.
 *
 * Built to the dataviz mark specs: 2px lines with round caps, markers r>=4 carrying
 * a 2px surface ring, a ~10% area wash, hairline solid recessive gridlines, and
 * selective direct labels rather than a number on every point.
 *
 * The palette is deliberately ONE hue plus a neutral. Actual and forecast are the
 * same entity in two time regimes, so they share the hue and separate by line
 * style; the baseline is a reference, not a competing series. Identity therefore
 * survives a greyscale photocopy, and no status colour is borrowed for a series.
 */

import { CHART } from './css.js';

const escapeXml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const parseDay = (day) => Date.parse(`${day}T00:00:00Z`);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (day) => {
  const [y, m] = day.split('-');
  return `${MONTHS[Number(m) - 1]} ${y.slice(2)}`;
};

const round = (n) => Math.round(n * 10) / 10;

/**
 * Cumulative progress S-curve: baseline plan, recorded actual, and forecast.
 *
 * @param {object} sCurve  model.sCurve
 * @param {object} options { dataDate, colours }
 */
export function sCurveSvg(sCurve, options = {}) {
  const { colours } = options;
  const W = 660;
  const H = 208;
  const pad = { top: 18, right: 52, bottom: 26, left: 30 };

  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const allPoints = [...sCurve.planned, ...sCurve.forecast, ...sCurve.actual];
  if (allPoints.length < 2) {
    return emptyChart(W, H, sCurve.emptyReason ?? 'Not enough programme history to plot a curve', colours);
  }

  const times = allPoints.map((p) => parseDay(p.date)).filter((t) => !Number.isNaN(t));
  // The contract completion date is part of the story even when it sits beyond
  // every curve - a forecast drifting past it is exactly what the reader needs to
  // see - so it participates in the domain.
  if (options.contractDate && !Number.isNaN(parseDay(options.contractDate))) {
    times.push(parseDay(options.contractDate));
  }
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const span = maxT - minT || 1;

  const x = (day) => pad.left + ((parseDay(day) - minT) / span) * plotW;
  const y = (percent) => pad.top + plotH - (Math.max(0, Math.min(100, percent)) / 100) * plotH;

  const line = (points) =>
    points
      .filter((p) => !Number.isNaN(parseDay(p.date)))
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${round(x(p.date))},${round(y(p.percent))}`)
      .join(' ');

  const parts = [];

  // Gridlines: hairline, solid, one step off the surface. Recessive by design -
  // they carry the values that are not directly labelled, nothing more.
  for (const value of [0, 25, 50, 75, 100]) {
    const gy = round(y(value));
    parts.push(
      `<line x1="${pad.left}" y1="${gy}" x2="${pad.left + plotW}" y2="${gy}" stroke="${colours.rule}" stroke-width="1"/>`,
      `<text x="${pad.left - 6}" y="${gy + 3}" text-anchor="end" font-size="9" fill="${colours.muted}">${value}%</text>`,
    );
  }

  // X axis ticks at ~5 evenly spaced dates.
  const ticks = 5;
  for (let i = 0; i <= ticks; i++) {
    const t = minT + (span * i) / ticks;
    const day = new Date(t).toISOString().slice(0, 10);
    parts.push(
      `<text x="${round(pad.left + (plotW * i) / ticks)}" y="${H - 8}" text-anchor="middle" font-size="9" fill="${colours.muted}">${monthLabel(day)}</text>`,
    );
  }

  // Data date - the moment the programme was last recalculated. Everything to the
  // right of it is forecast, not fact, and the reader should see where that line is.
  if (options.dataDate && !Number.isNaN(parseDay(options.dataDate))) {
    const dx = round(x(options.dataDate));
    if (dx >= pad.left && dx <= pad.left + plotW) {
      parts.push(
        `<line x1="${dx}" y1="${pad.top}" x2="${dx}" y2="${pad.top + plotH}" stroke="${colours.muted}" stroke-width="1" stroke-dasharray="2 3"/>`,
        `<text x="${dx + 3}" y="${pad.top + 8}" font-size="8" fill="${colours.muted}">Data date</text>`,
      );
    }
  }

  // Contract completion - the line the whole chart is read against. Ink, solid,
  // labelled; a forecast crossing it should be unmissable without a single word.
  if (options.contractDate && !Number.isNaN(parseDay(options.contractDate))) {
    const cx = round(x(options.contractDate));
    if (cx >= pad.left && cx <= pad.left + plotW) {
      parts.push(
        `<line x1="${cx}" y1="${pad.top - 6}" x2="${cx}" y2="${pad.top + plotH}" stroke="${colours.ink}" stroke-width="1.2"/>`,
        `<text x="${cx - 4}" y="${pad.top + 2}" text-anchor="end" font-size="8" font-weight="600" fill="${colours.ink}">Contract completion</text>`,
      );
    }
  }

  // Baseline plan: neutral reference, thinner than the data series.
  if (sCurve.planned.length > 1) {
    parts.push(
      `<path d="${line(sCurve.planned)}" fill="none" stroke="${CHART.reference}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>`,
    );
  }

  // Forecast: same hue as actual, dashed. Dashing here means projection, which is
  // exactly what it is. The endpoint is labelled with its date - the forecast
  // completion is the figure this chart exists to show arriving.
  if (sCurve.forecast.length > 1) {
    parts.push(
      `<path d="${line(sCurve.forecast)}" fill="none" stroke="${CHART.series}" stroke-width="2" stroke-dasharray="5 3" stroke-linejoin="round" stroke-linecap="round" opacity="0.75"/>`,
    );
    const end = sCurve.forecast.at(-1);
    if (!Number.isNaN(parseDay(end.date))) {
      const [, m, d] = end.date.split('-');
      // Label sits in the right padding, clear of the contract-completion label
      // which owns the top edge.
      parts.push(
        `<circle cx="${round(x(end.date))}" cy="${round(y(end.percent))}" r="3" fill="none" stroke="${CHART.series}" stroke-width="1.5"/>`,
        `<text x="${round(x(end.date)) + 7}" y="${round(y(end.percent)) + 3}" text-anchor="start" font-size="8.5" font-weight="600" fill="${CHART.series}">${Number(d)} ${MONTHS[Number(m) - 1]}</text>`,
      );
    }
  }

  // Actual: the recorded truth. Area wash beneath it, markers on every real
  // measurement, each with a surface ring so it stays legible where lines cross.
  if (sCurve.actual.length > 0) {
    if (sCurve.actual.length > 1) {
      const baseline = pad.top + plotH;
      const area = `${line(sCurve.actual)} L${round(x(sCurve.actual.at(-1).date))},${baseline} L${round(x(sCurve.actual[0].date))},${baseline} Z`;
      parts.push(`<path d="${area}" fill="${CHART.seriesWash}" stroke="none"/>`);
      parts.push(
        `<path d="${line(sCurve.actual)}" fill="none" stroke="${CHART.series}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
      );
    }

    for (const point of sCurve.actual) {
      parts.push(
        `<circle cx="${round(x(point.date))}" cy="${round(y(point.percent))}" r="4" fill="${CHART.series}" stroke="#FFFFFF" stroke-width="2"/>`,
      );
    }

    // Direct label on the endpoint only. A value beside every point goes unread.
    const last = sCurve.actual.at(-1);
    parts.push(
      `<text x="${round(x(last.date)) + 8}" y="${round(y(last.percent)) + 3}" font-size="10" font-weight="600" fill="${colours.ink}">${round(last.percent)}%</text>`,
    );
  }

  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cumulative progress S-curve">${parts.join('')}</svg>`;
}

function emptyChart(W, H, reason, colours) {
  return [
    `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeXml(reason)}">`,
    `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="none" stroke="${colours.rule}" stroke-width="1"/>`,
    `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-size="12" fill="${colours.muted}" font-style="italic">${escapeXml(reason)}</text>`,
    '</svg>',
  ].join('');
}

/**
 * The S-curve legend. Three series, so a legend is mandatory - identity is never
 * left to colour matching alone. Line style is the secondary channel.
 */
export function sCurveLegend(colours, { hasPlanned, hasActual }) {
  const keys = [];

  if (hasPlanned) {
    keys.push(
      `<span class="key"><span class="swatch" style="border-top-color:${CHART.reference}"></span>Baseline plan</span>`,
    );
  }
  if (hasActual) {
    keys.push(
      `<span class="key"><span class="swatch" style="border-top-color:${CHART.series}"></span>Actual (recorded)</span>`,
    );
  }
  keys.push(
    `<span class="key"><span class="swatch" style="border-top-color:${CHART.series};border-top-style:dashed"></span>Forecast</span>`,
  );

  return `<div class="legend">${keys.join('')}</div>`;
}

/**
 * A progress meter: recorded progress against what the baseline planned.
 *
 * The planned position is a tick on the track rather than a second bar, so the
 * comparison reads at a glance without inventing a second scale.
 */
export function progressMeter({ actual, planned }, colours) {
  const W = 300;
  const H = 22;
  const trackY = 6;
  const trackH = 8;

  if (actual === null || actual === undefined) return '';

  const fill = Math.max(0, Math.min(100, actual));
  const parts = [
    `<rect x="0" y="${trackY}" width="${W}" height="${trackH}" rx="2" fill="${colours.rule}"/>`,
    // 4px rounded data-end, square at the baseline.
    `<rect x="0" y="${trackY}" width="${round((fill / 100) * W)}" height="${trackH}" rx="2" fill="${CHART.series}"/>`,
  ];

  if (planned !== null && planned !== undefined) {
    const px = round((Math.max(0, Math.min(100, planned)) / 100) * W);
    parts.push(
      `<line x1="${px}" y1="${trackY - 3}" x2="${px}" y2="${trackY + trackH + 3}" stroke="${colours.ink}" stroke-width="1.5"/>`,
      `<text x="${px}" y="${H}" text-anchor="middle" font-size="8" fill="${colours.muted}">plan</text>`,
    );
  }

  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Progress against plan"><g>${parts.join('')}</g></svg>`;
}

export const _internals = { escapeXml, monthLabel };
