import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = await mkdtemp(path.join(tmpdir(), 'pm-report-test-'));
process.env.LEDGER_ROOT = path.join(root, 'projects');

const { _internals, hasValue, notMeasured, measured } = await import('../src/report/model.js');
const { buildWeeklyModel } = await import('../src/report/model.js');
const { sCurveSvg, sCurveLegend, progressMeter } = await import('../src/report/html/charts.js');
const { fontFaceCss } = await import('../src/report/html/fonts.js');
const { loadBrand, DEFAULTS } = await import('../src/report/html/brand.js');
const { figure } = await import('../src/report/html/components.js');
const { renderWeeklyHtml } = await import('../src/report/html/weekly.js');
const { scaffoldProject } = await import('../src/ledger/scaffold.js');
const { ingestXer } = await import('../src/programme/ingest.js');
const { writeYaml } = await import('../src/ledger/store.js');
const { projectPaths } = await import('../src/ledger/paths.js');
const { makeXer, BASE_PROGRAMME, REVISED_PROGRAMME } = await import('./fixtures/make-xer.js');
const { parseXerText } = await import('../src/parse/xer.js');
const { normalizeProgramme } = await import('../src/parse/normalize.js');

const colours = DEFAULTS.colours;

test.after(() => rm(root, { recursive: true, force: true }));

// --- provenance ------------------------------------------------------------

test('a missing measurement is never rendered as a number', () => {
  const missing = notMeasured('No baseline programme ingested');
  assert.equal(hasValue(missing), false);
  const html = figure(missing);
  assert.match(html, /Not measured/);
  assert.match(html, /No baseline programme ingested/);
  // The failure mode this exists to prevent.
  assert.doesNotMatch(html, /\b0\b/);
});

test('a real measurement renders as its value', () => {
  assert.equal(figure(measured(62, '2026-08-01'), { suffix: '%' }), '62%');
});

test('zero is a real measurement and is not confused with missing', () => {
  assert.equal(figure(measured(0, '2026-08-01'), { suffix: '%' }), '0%');
});

// --- progress weighting ----------------------------------------------------

const programme = normalizeProgramme(parseXerText(makeXer(BASE_PROGRAMME)));

test('progress is weighted by duration, not by activity count', () => {
  // Three trivial activities finished, one large one untouched. Counting
  // activities says 75% complete; the project is plainly 13% complete. This is
  // exactly the distortion that puts a fictional number in a payment application.
  const lopsided = normalizeProgramme(
    parseXerText(
      makeXer({
        ...BASE_PROGRAMME,
        activities: [
          { code: 'L-1', name: 'Main frame', status: 'TK_NotStart', durationDays: 100, remainingDays: 100, percentComplete: '0', planStart: '2026-01-05', planFinish: '2026-05-25' },
          { code: 'S-1', name: 'Snag 1', status: 'TK_Complete', durationDays: 5, remainingDays: 0, percentComplete: '100', planStart: '2026-01-05', planFinish: '2026-01-09' },
          { code: 'S-2', name: 'Snag 2', status: 'TK_Complete', durationDays: 5, remainingDays: 0, percentComplete: '100', planStart: '2026-01-05', planFinish: '2026-01-09' },
          { code: 'S-3', name: 'Snag 3', status: 'TK_Complete', durationDays: 5, remainingDays: 0, percentComplete: '100', planStart: '2026-01-05', planFinish: '2026-01-09' },
        ],
        relationships: [],
      }),
    ),
  );

  const result = _internals.weightedProgress(lopsided);
  assert.equal(result.basis, 'duration');
  // 15 of 115 duration-days earned.
  assert.equal(result.percent, 13);
  assert.ok(result.percent < 20, 'must not approach the 75% an activity count would report');
});

test('progress weighting ignores level-of-effort and summary rows', () => {
  const result = _internals.weightedProgress(programme);
  assert.equal(result.basis, 'duration');
  // The finish milestone has zero duration and so contributes no weight.
  assert.equal(result.percent, 34.4);
});

test('planned progress at a date comes from the baseline, straight-line', () => {
  const atStart = _internals.plannedProgressAt(programme, '2026-01-05');
  const atEnd = _internals.plannedProgressAt(programme, '2026-12-31');
  assert.ok(atStart < 5, `expected near zero at project start, got ${atStart}`);
  assert.equal(atEnd, 100);
});

test('planned progress is monotonic through the programme', () => {
  const dates = ['2026-02-01', '2026-05-01', '2026-08-01', '2026-11-01'];
  const values = dates.map((d) => _internals.plannedProgressAt(programme, d));
  assert.deepEqual(values, [...values].sort((a, b) => a - b));
});

// --- status ----------------------------------------------------------------

test('status is red when the completion date moved out', () => {
  const status = _internals.computeStatus({ completionShiftDays: 4, negativeFloatCount: 0, overdueDecisions: 0 });
  assert.equal(status.rag, 'red');
  assert.match(status.basis, /completion moved out 4d/);
});

test('status is red on negative float even when the date held', () => {
  // The masking case: work slipped, the date did not move.
  const status = _internals.computeStatus({ completionShiftDays: 0, negativeFloatCount: 2, overdueDecisions: 0 });
  assert.equal(status.rag, 'red');
  assert.match(status.basis, /negative float/);
});

test('status is amber on an overdue decision', () => {
  const status = _internals.computeStatus({ completionShiftDays: 0, negativeFloatCount: 0, overdueDecisions: 1 });
  assert.equal(status.rag, 'amber');
});

test('status states the rule it applied, so it can be argued with', () => {
  const status = _internals.computeStatus({ completionShiftDays: null, negativeFloatCount: 0, overdueDecisions: 0 });
  assert.equal(status.rag, 'green');
  assert.ok(status.basis.length > 0);
});

// --- look-ahead ------------------------------------------------------------

const exceptionsStub = {
  all: [
    { code: 'A-1', name: 'Blocked one', totalFloatDays: 2, planStart: '2026-08-10', critical: true },
    { code: 'A-2', name: 'Clear one', totalFloatDays: 30, planStart: '2026-08-11', critical: false },
  ],
};

test('an activity with an open register item against it is blocked, with the blocker named', () => {
  const registers = {
    rfi: { entries: [{ ref: 'RFI-014', subject: 'Riser coordination', activity: 'A-1', owner: 'Engineer', date: '2026-07-08', status: 'open' }] },
  };
  const result = _internals.buildLookahead(exceptionsStub, registers, { asOf: '2026-08-05' });

  const blocked = result.items.find((i) => i.code === 'A-1');
  assert.equal(blocked.state, 'blocked');
  assert.equal(blocked.blockers[0].ref, 'RFI-014');
  assert.equal(blocked.blockers[0].daysOpen, 28);
  assert.equal(result.items.find((i) => i.code === 'A-2').state, 'ready');
});

test('readiness is unverified rather than ready when no register has been populated', () => {
  // A false Ready gets labour planned around it, so an empty register must not
  // be read as "nothing is blocking".
  const result = _internals.buildLookahead(exceptionsStub, { rfi: { entries: [] } }, { asOf: '2026-08-05' });
  assert.ok(result.items.every((i) => i.state === 'unverified'));
  assert.equal(result.ready, 0);
  assert.equal(result.registersChecked, false);
});

test('a closed register item does not block', () => {
  const registers = {
    rfi: {
      entries: [
        { ref: 'RFI-013', activity: 'A-1', status: 'closed', date: '2026-06-01' },
        { ref: 'RFI-020', activity: 'A-2', status: 'open', date: '2026-08-01' },
      ],
    },
  };
  const result = _internals.buildLookahead(exceptionsStub, registers, { asOf: '2026-08-05' });
  assert.equal(result.items.find((i) => i.code === 'A-1').state, 'ready');
  assert.equal(result.items.find((i) => i.code === 'A-2').state, 'blocked');
});

test('the look-ahead is ordered by float, tightest first', () => {
  const result = _internals.buildLookahead(exceptionsStub, {}, { asOf: '2026-08-05' });
  assert.deepEqual(result.items.map((i) => i.code), ['A-1', 'A-2']);
});

// --- registers -------------------------------------------------------------

test('register turnaround is measured against the contractual response period', () => {
  const register = {
    entries: [
      { ref: 'SUB-042', subject: 'Containment drawings', date: '2026-07-05', owner: 'Engineer', status: 'open' },
      { ref: 'SUB-050', subject: 'Recent one', date: '2026-08-01', status: 'open' },
      { ref: 'SUB-041', subject: 'Done', date: '2026-06-01', status: 'approved' },
    ],
  };
  const summary = _internals.registerSummary(register, { asOf: '2026-08-05', responseDays: 21, label: 'Submittals' });

  assert.equal(summary.total, 3);
  assert.equal(summary.open, 2);
  // Only SUB-042 (31 days) is beyond the 21-day period.
  assert.equal(summary.overdue, 1);
  assert.equal(summary.overdueEntries[0].ref, 'SUB-042');
  assert.equal(summary.oldestOpenDays, 31);
});

test('with no response period recorded, nothing is declared overdue', () => {
  const register = { entries: [{ ref: 'N-1', date: '2020-01-01', status: 'open' }] };
  const summary = _internals.registerSummary(register, { asOf: '2026-08-05', responseDays: null, label: 'NCRs' });
  assert.equal(summary.overdue, 0);
});

// --- charts ----------------------------------------------------------------

const series = (values) => values.map(([date, percent]) => ({ date, percent }));

test('the S-curve plots each series and directly labels only the endpoint', () => {
  const svg = sCurveSvg(
    {
      planned: series([['2026-01-01', 0], ['2026-12-01', 100]]),
      forecast: series([['2026-01-01', 0], ['2026-12-01', 100]]),
      actual: series([['2026-03-01', 20], ['2026-06-01', 45]]),
      emptyReason: null,
    },
    { dataDate: '2026-06-01', colours },
  );

  assert.match(svg, /<svg viewBox/);
  // Two actual points make two markers, plus the ring on the forecast endpoint -
  // and exactly one direct percentage label.
  assert.equal((svg.match(/<circle/g) ?? []).length, 3);
  assert.equal((svg.match(/45%/g) ?? []).length, 1);
  assert.match(svg, /stroke-dasharray/, 'forecast is dashed');
  assert.match(svg, /Data date/);
});

test('the S-curve states why it is empty rather than drawing an invented line', () => {
  const svg = sCurveSvg(
    { planned: [], forecast: [], actual: [], emptyReason: 'No baseline ingested' },
    { colours },
  );
  assert.match(svg, /No baseline ingested/);
  assert.doesNotMatch(svg, /<path/);
});

test('the legend omits the baseline key when there is no baseline', () => {
  const withBaseline = sCurveLegend(colours, { hasPlanned: true, hasActual: true });
  const without = sCurveLegend(colours, { hasPlanned: false, hasActual: true });
  assert.match(withBaseline, /Baseline plan/);
  assert.doesNotMatch(without, /Baseline plan/);
  // Forecast is always shown, so a legend is always present.
  assert.match(without, /Forecast/);
});

test('chart text is XML-safe', () => {
  const svg = sCurveSvg(
    { planned: [], forecast: [], actual: [], emptyReason: 'Ampersand & angle < test' },
    { colours },
  );
  assert.match(svg, /Ampersand &amp; angle &lt; test/);
});

test('the progress meter marks the planned position on the track', () => {
  const svg = progressMeter({ actual: 50, planned: 86 }, colours);
  assert.match(svg, /<line/);
  assert.match(svg, />plan</);
});

test('the progress meter renders nothing when progress is unknown', () => {
  assert.equal(progressMeter({ actual: null, planned: 50 }, colours), '');
});

// --- fonts and brand -------------------------------------------------------

test('fonts are embedded as data URIs, not linked', async () => {
  const { css, embedded, missing } = await fontFaceCss();
  assert.deepEqual(missing, [], 'all declared faces should be present in report-assets');
  assert.equal(embedded.length, 5);
  assert.match(css, /src: url\(data:font\/woff2;base64,/);
  assert.doesNotMatch(css, /https?:/, 'a client report must not depend on a network fetch');
});

test('static font weights are declared, not a variable axis', async () => {
  // A variable font makes Chromium fall back to Type3, which loses selectable text.
  const { css } = await fontFaceCss();
  assert.doesNotMatch(css, /font-weight: \d+ \d+/);
  for (const weight of [400, 500, 600]) assert.match(css, new RegExp(`font-weight: ${weight};`));
});

test('brand falls back to defaults and warns when nothing is configured', async () => {
  const brand = await loadBrand('NOT-A-PROJECT');
  assert.equal(brand.company.name, 'PMCC');
  assert.equal(brand.colours.accent, '#EAB308');
  assert.ok(brand.warnings.some((w) => /No brand config/.test(w)));
  assert.ok(brand.warnings.some((w) => /contact details/.test(w)));
});

// --- end to end ------------------------------------------------------------

const CODE = 'RPT-01';

test('builds a full weekly model from a ledger', async () => {
  await scaffoldProject(CODE, { name: 'Report Test Tower' });

  const baseFile = path.join(root, 'base.xer');
  const revisedFile = path.join(root, 'revised.xer');
  await writeFile(baseFile, makeXer(BASE_PROGRAMME), 'latin1');
  await writeFile(revisedFile, makeXer(REVISED_PROGRAMME), 'latin1');

  await ingestXer(CODE, baseFile, { baseline: true });
  await ingestXer(CODE, baseFile);
  await ingestXer(CODE, revisedFile);

  const paths = projectPaths(CODE);
  await writeYaml(paths.decisions, {
    nextRef: 2,
    entries: [
      {
        ref: 'DEC-001',
        subject: 'Facade sample approval',
        owner: 'Employer',
        dueDate: '2026-08-01',
        consequence: 'Procurement cannot be released',
        status: 'open',
      },
    ],
  });

  const model = await buildWeeklyModel(CODE, { asOf: '2026-08-05' });

  assert.equal(model.meta.code, CODE);
  assert.equal(model.meta.weekStart, '2026-07-30');
  assert.equal(model.status.rag, 'red', 'the revised programme has negative float');
  assert.equal(model.decisions.length, 1);
  assert.equal(model.decisions[0].overdue, true);
  assert.equal(model.kpis.decisions.overdue, 1);

  // Three ingested snapshots, so the actual curve has a point for each.
  assert.equal(model.sCurve.actual.length, 2, 'two distinct data dates in 01-programme/parsed');
  assert.ok(model.sCurve.planned.length > 1, 'a baseline was ingested so a planned curve exists');

  // The diff drives the movements list, so the sneaky revision surfaces here.
  const text = model.movements.map((m) => m.text).join(' ');
  assert.match(text, /logic link was removed/);
});

test('the weekly model reports no baseline honestly rather than inventing one', async () => {
  await scaffoldProject('RPT-02', { name: 'No Baseline' });
  const file = path.join(root, 'nb.xer');
  await writeFile(file, makeXer(BASE_PROGRAMME), 'latin1');
  await ingestXer('RPT-02', file);

  const model = await buildWeeklyModel('RPT-02', { asOf: '2026-08-05' });

  assert.equal(model.kpis.progress.planned.provenance, 'not-measured');
  assert.equal(model.kpis.progress.planned.value, null);
  assert.equal(model.kpis.progress.variance.provenance, 'not-measured');
  // Actual progress is still real - it comes from the P6 update itself.
  assert.equal(model.kpis.progress.actual.provenance, 'programme');
  assert.ok(model.warnings.some((w) => /No baseline/.test(w)));
});

test('empty registers do not produce an appendix of zeroes', async () => {
  const model = await buildWeeklyModel('RPT-02', { asOf: '2026-08-05' });
  assert.equal(model.appendices.registers, null);
  assert.equal(model.appendices.photos, null);
  assert.equal(model.appendices.events, null);
});

test('renders self-contained HTML with no external references', async () => {
  const model = await buildWeeklyModel(CODE, { asOf: '2026-08-05' });
  const brand = await loadBrand(CODE);
  const { html } = await renderWeeklyHtml(model, brand);

  assert.match(html, /<!doctype html>/);
  // The whole point of a single-file deliverable: nothing to fetch.
  assert.doesNotMatch(html, /<link[^>]+href="http/);
  assert.doesNotMatch(html, /<script/);
  assert.doesNotMatch(html, /src="http/);
  assert.match(html, /Decisions required from you/);
  assert.match(html, /Weekly Progress Report/);
});

test('the report always asks for decisions, even when there are none', async () => {
  const model = await buildWeeklyModel('RPT-02', { asOf: '2026-08-05' });
  const brand = await loadBrand('RPT-02');
  const { html } = await renderWeeklyHtml(model, brand);
  assert.match(html, /Decisions required from you/);
  assert.match(html, /No decisions outstanding from you this week/);
});
