/**
 * The print stylesheet.
 *
 * Written for paper, not for a screen that happens to be printed. Sizes are in mm
 * and pt because that is what the output is measured in, and every colour is
 * checked to survive a black-and-white photocopy - which is what a client's
 * document controller will do to it.
 *
 * The design language is the company's own: charcoal band, bone type, one yellow
 * rule, Fraunces for the few numbers that carry the story and IBM Plex Sans for
 * everything that has to line up. Two registers - display and working - and
 * nothing in between.
 *
 * Chromium does not implement CSS @page margin boxes (@bottom-center et al), so
 * page numbering comes from Playwright's footerTemplate, not from here. Page
 * margins are likewise set by page.pdf() so the two never fight.
 */

/** Chart palette. Validated with the dataviz skill's validator against white paper:
 *  lightness band, chroma floor, and 3:1 contrast all pass.
 *
 *  Deliberately ONE hue. Actual and forecast are the same entity in two time
 *  regimes, so they share a colour and separate by line style; the baseline is a
 *  neutral reference rather than a competing series. That keeps identity readable
 *  in greyscale and avoids borrowing a status colour for a data series. */
export const CHART = {
  series: '#1D4ED8',
  seriesWash: 'rgba(29, 78, 216, 0.10)',
  reference: '#9CA3AF',
};

/** The display face, with named fallbacks so a missing font is diagnosable. */
export const DISPLAY = "'Fraunces', 'Liberation Serif', Georgia, serif";

export function stylesheet(brand, { fontCss }) {
  const c = brand.colours;

  return `
${fontCss}

/* Tinted panels and coloured rules are information here, not decoration, so they
   must not be stripped by the print pipeline. */
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

html, body {
  margin: 0;
  padding: 0;
  background: #FFFFFF;
  color: ${c.body};
  font-family: 'IBM Plex Sans', 'Liberation Sans', 'Helvetica Neue', Arial, sans-serif;
  font-size: 8.6pt;
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
}

/* Every column of numbers aligns; standalone display figures do not use tabular
   digits, because equal-width digits make a large number look loose. */
table, .tabular { font-variant-numeric: tabular-nums; }

h1, h2, h3, h4 { margin: 0; color: ${c.ink}; font-weight: 600; }

a { color: inherit; text-decoration: none; }

.page { page-break-after: always; }
.page:last-child { page-break-after: auto; }

/* ---------- masthead ---------- */

/* Row 1 stays on white so an arbitrary client logo - dark, light, whatever they
   supply - is never swallowed by the band beneath it. */
.masthead-top {
  display: flex; align-items: center; justify-content: space-between; gap: 8mm;
  padding-bottom: 3.2mm;
}
.masthead-top .mark { display: flex; align-items: center; gap: 3.6mm; }
.masthead-top img { height: ${brand.page.logoHeightMm ?? brand.company.logoHeightMm ?? 12}mm; width: auto; display: block; }
.masthead-top .company {
  font-family: ${DISPLAY};
  font-size: 14pt; font-weight: 600; color: ${c.ink}; letter-spacing: 0.01em;
}
.masthead-top .descriptor { font-size: 7pt; color: ${c.muted}; margin-top: 0.5mm; letter-spacing: 0.02em; }
.masthead-top .doctype { text-align: right; }
.masthead-top .doctype .kind {
  font-size: 8pt; font-weight: 600; color: ${c.ink};
  text-transform: uppercase; letter-spacing: 0.16em;
}
.masthead-top .doctype .no { font-size: 7.2pt; color: ${c.muted}; margin-top: 0.9mm; }

/* The band. Charcoal, bone, and the one yellow rule - the entire brand in 22mm. */
.band {
  background: ${c.band};
  padding: 4.6mm 6mm 4.4mm;
  display: flex; justify-content: space-between; align-items: flex-end; gap: 10mm;
}
.band .name {
  font-family: ${DISPLAY};
  font-size: 19pt; font-weight: 600; color: ${c.bone};
  letter-spacing: 0.005em; line-height: 1.08;
}
.band .meta {
  font-size: 7pt; color: ${c.boneMuted}; text-align: right;
  line-height: 1.55; white-space: nowrap; padding-bottom: 0.6mm;
}
.band .meta .code { color: ${c.bone}; font-weight: 600; letter-spacing: 0.08em; }
.band-accent { height: 1.3mm; background: ${c.accent}; }

/* ---------- the data strip ---------- */

/* One open row, hairline-divided - the four numbers that are the report. Boxes
   around each would file them as form fields; open columns read as a statement. */
.strip {
  display: flex; align-items: stretch;
  border-bottom: 0.3mm solid ${c.rule};
  margin-top: 4.6mm;
}
.strip .cell {
  flex: 1 1 0; min-width: 0;
  padding: 3mm 4mm 3mm 0;
}
.strip .cell + .cell { border-left: 0.3mm solid ${c.rule}; padding-left: 4mm; }
.strip .cell.lead { flex: 1.45 1 0; }
.strip .label {
  font-size: 6.6pt; color: ${c.muted}; text-transform: uppercase;
  letter-spacing: 0.13em; font-weight: 500;
}
.strip .value {
  font-family: ${DISPLAY};
  font-size: 16.5pt; font-weight: 600; color: ${c.ink};
  margin-top: 1.7mm; line-height: 1.05; letter-spacing: 0.005em;
}
.strip .cell.lead .value { font-size: 21pt; }
.strip .delta { font-size: 7.4pt; margin-top: 1.4mm; font-weight: 600; }
.strip .sub { font-size: 6.8pt; color: ${c.muted}; margin-top: 1mm; line-height: 1.4; }

/* Not-measured is stated, never rendered as zero. It reads as an admitted gap. */
.unmeasured { font-family: 'IBM Plex Sans', sans-serif; font-size: 9.5pt; font-weight: 500; color: ${c.muted}; font-style: italic; letter-spacing: 0; }
.unmeasured-note { font-family: 'IBM Plex Sans', sans-serif; font-size: 6.4pt; color: ${c.muted}; font-style: normal; margin-top: 0.6mm; }

/* ---------- status ---------- */

/* Never colour alone: every pill carries its word, so it survives greyscale. */
.pill {
  display: inline-block; padding: 0.7mm 2.2mm; border-radius: 0.8mm;
  font-size: 6.8pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.09em;
  border: 0.3mm solid currentColor;
  font-family: 'IBM Plex Sans', sans-serif;
}
.pill.green { color: ${c.green}; background: rgba(21, 128, 61, 0.07); }
.pill.amber { color: ${c.amber}; background: rgba(180, 83, 9, 0.07); }
.pill.red   { color: ${c.red};   background: rgba(185, 28, 28, 0.07); }
.pill.grey  { color: ${c.muted}; background: ${c.panel}; }

/* The strip's status cell sets its pill large - same device, display scale. */
.strip .pill { font-size: 9pt; padding: 1.2mm 3.2mm; margin-top: 2.2mm; }

.dot { display: inline-block; width: 1.8mm; height: 1.8mm; border-radius: 50%; margin-right: 1.2mm; vertical-align: middle; }
.dot.green { background: ${c.green}; } .dot.amber { background: ${c.amber}; } .dot.red { background: ${c.red}; }

/* ---------- sections ---------- */

.section { margin-top: 5mm; break-inside: avoid; }
.section > .eyebrow, .eyebrow {
  position: relative;
  font-size: 7pt; font-weight: 600; color: ${c.ink};
  text-transform: uppercase; letter-spacing: 0.13em;
  padding-bottom: 1.5mm; border-bottom: 0.3mm solid ${c.rule};
  margin-bottom: 2.4mm;
}
/* The yellow tick: a 9mm segment of the brand rule under every section head. */
.eyebrow::after {
  content: ''; position: absolute; left: 0; bottom: -0.3mm;
  width: 9mm; height: 0.3mm; background: ${c.accent};
}
.eyebrow .index {
  color: ${c.muted}; font-weight: 500; letter-spacing: 0.08em;
  margin-right: 2.4mm;
}
.eyebrow .count { color: ${c.muted}; font-weight: 400; letter-spacing: 0.05em; float: right; }

.cols { display: flex; gap: 7mm; align-items: flex-start; }
.cols > * { min-width: 0; }
.col-60 { flex: 0 0 58%; }
.col-40 { flex: 1 1 auto; }

/* ---------- movements ---------- */

.movements { list-style: none; margin: 0; padding: 0; }
.movements li {
  position: relative; padding-left: 4.4mm; margin-bottom: 1.4mm; font-size: 8.4pt;
}
/* Square markers, not dots: the same mark the website uses for list items. */
.movements li::before {
  content: ''; position: absolute; left: 0; top: 1.6mm;
  width: 1.5mm; height: 1.5mm; background: ${c.rule};
}
.movements li.emphasis { font-weight: 500; color: ${c.ink}; }
.movements li.emphasis::before { background: ${c.accent}; }
.movements li.flag::before { background: ${c.amber}; }

/* ---------- tables ---------- */

table { width: 100%; border-collapse: collapse; font-size: 7.6pt; table-layout: fixed; }
thead th {
  text-align: left; font-size: 6.4pt; font-weight: 600; color: ${c.muted};
  text-transform: uppercase; letter-spacing: 0.09em;
  padding: 0 2mm 1.5mm 0; border-bottom: 0.5mm solid ${c.ink};
}
tbody td { padding: 1.5mm 2mm 1.5mm 0; word-wrap: break-word; border-bottom: 0.25mm solid ${c.rule}; vertical-align: top; }
tbody tr:last-child td { border-bottom: none; }
/* Right-aligned columns keep a gutter unless they are the last column, otherwise
   a right-aligned value butts straight into the next heading. */
td.num, th.num { text-align: right; padding-right: 3mm; }
tr > td.num:last-child, tr > th.num:last-child { padding-right: 0; }
td.strong { color: ${c.ink}; font-weight: 500; }
.strong { color: ${c.ink}; font-weight: 500; }
.muted { color: ${c.muted}; }
.tight { font-size: 6.8pt; line-height: 1.35; }

/* ---------- callout ---------- */

.callout {
  border: 0.3mm solid ${c.rule}; border-left: 1.4mm solid ${c.amber};
  background: ${c.panel}; padding: 2.8mm 3.6mm; font-size: 7.4pt; margin-bottom: 3mm;
}
.callout .title {
  font-weight: 600; color: ${c.ink}; text-transform: uppercase;
  letter-spacing: 0.09em; font-size: 6.6pt; margin-bottom: 1.1mm;
}

.empty { font-size: 7.6pt; color: ${c.muted}; font-style: italic; padding: 1.5mm 0; }

/* ---------- chart ---------- */

.chart { width: 100%; }
.chart svg { display: block; width: 100%; height: auto; }
.legend { display: flex; gap: 5mm; margin-top: 1.8mm; font-size: 6.8pt; color: ${c.muted}; }
.legend .key { display: flex; align-items: center; gap: 1.4mm; }
.legend .swatch { width: 5mm; height: 0; border-top-width: 0.6mm; border-top-style: solid; }

/* ---------- photos ---------- */

.photos { display: grid; grid-template-columns: repeat(2, 1fr); gap: 5mm 5mm; }
.photo { break-inside: avoid; }
.photo img { width: 100%; height: 52mm; object-fit: cover; display: block; }
.photo .caption {
  font-size: 6.8pt; color: ${c.muted}; margin-top: 1.4mm; line-height: 1.4;
  padding-top: 1.2mm; border-top: 0.3mm solid ${c.rule};
}
.photo .caption .ref { color: ${c.ink}; font-weight: 600; }

/* ---------- appendix ---------- */

.appendix { page-break-before: always; }
.appendix .appendix-eyebrow {
  font-size: 7pt; font-weight: 600; color: ${c.muted};
  text-transform: uppercase; letter-spacing: 0.16em;
}
.appendix .appendix-title {
  font-family: ${DISPLAY};
  font-size: 15.5pt; font-weight: 600; color: ${c.ink};
  margin-top: 1.6mm; letter-spacing: 0.005em;
}
.appendix .appendix-sub { font-size: 7.4pt; color: ${c.muted}; margin-top: 1.4mm; }
.appendix .rule { margin-top: 3mm; }

/* The brand rule: a short yellow bar, exactly as the website letterheads it. */
.rule { height: 1.3mm; width: 30mm; background: ${c.accent}; }
.rule.full { width: 100%; height: 0.3mm; background: ${c.rule}; }

/* ---------- provenance footnote ---------- */

.provenance {
  margin-top: 4mm; padding-top: 1.8mm; border-top: 0.3mm solid ${c.rule};
  font-size: 6.4pt; color: ${c.muted}; line-height: 1.45;
}
`;
}
