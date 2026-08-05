/**
 * Generate the weekly client report end to end.
 *
 * Ledger -> model (with provenance) -> self-contained HTML -> optional PDF.
 * The output is written to 06-outputs/reports/ and committed. Nothing is sent:
 * a human issues it.
 */

import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { projectPaths } from '../ledger/paths.js';
import { ensureDir } from '../ledger/store.js';
import { commitLedger } from '../ledger/git.js';
import { buildWeeklyModel } from './model.js';
import { loadBrand } from './html/brand.js';
import { renderWeeklyHtml } from './html/weekly.js';
import { today } from '../util/dates.js';

/**
 * @param {string} projectCode
 * @param {{asOf?: string, reportNo?: number, pdf?: boolean, png?: string, commit?: boolean}} options
 */
export async function generateWeeklyReport(projectCode, options = {}) {
  const asOf = options.asOf ?? today();
  const paths = projectPaths(projectCode);

  const model = await buildWeeklyModel(projectCode, { asOf, reportNo: options.reportNo });
  const brand = await loadBrand(projectCode);
  const { html, warnings: renderWarnings } = await renderWeeklyHtml(model, brand);

  await ensureDir(paths.reports);

  const stem = `${asOf}-weekly-report-${String(model.meta.reportNo).padStart(2, '0')}`;
  const htmlFile = path.join(paths.reports, `${stem}.html`);
  await writeFile(htmlFile, html, 'utf8');

  const written = [htmlFile];
  const warnings = [...brand.warnings, ...model.warnings, ...renderWarnings];
  let pdfResult = null;

  let pdfError = null;

  if (options.pdf) {
    // Imported lazily so the whole report path works without a browser installed.
    const { htmlToPdf } = await import('./pdf.js');
    const pdfFile = path.join(paths.reports, `${stem}.pdf`);
    try {
      pdfResult = await htmlToPdf(html, pdfFile, model, brand);
      written.push(pdfFile);
    } catch (error) {
      // The report itself succeeded - only the rendering of it failed. Losing a
      // week's report because a browser is missing on the machine would be a far
      // worse failure than handing over the HTML and saying so.
      pdfError = error;
      warnings.push(`PDF not rendered: ${summarisePdfError(error)}`);
    }
  }

  let png = null;
  if (options.png) {
    const { htmlToPng, contentHeightMm } = await import('./pdf.js');
    png = await htmlToPng(html, options.png, {
      marginSideMm: brand.page.marginSideMm,
      selector: options.pngSelector ?? '.page',
    });
    png.limitMm = contentHeightMm(brand);
    // Page 1 is the deliverable. If it does not fit on one sheet the report has
    // failed at its main job, so this is a warning, not a footnote.
    if (png.heightMm && png.heightMm > png.limitMm) {
      warnings.push(
        `Page 1 is ${png.heightMm}mm tall against a ${png.limitMm}mm printable area — it will overflow onto a second sheet.`,
      );
    }
    if (png.overflow?.length) {
      warnings.push(`Content wider than the page and will be cropped: ${png.overflow.join(', ')}`);
    }
  }

  let sha = null;
  if (options.commit !== false) {
    sha = await commitLedger(
      written,
      `report(${projectCode}): weekly progress report no. ${model.meta.reportNo}, week ending ${asOf}`,
    );
  }

  return { model, brand, html, htmlFile, pdf: pdfResult, pdfError, png, warnings, sha, written };
}

/**
 * Playwright's launch failure is a twelve-line ASCII box aimed at a developer in
 * a terminal. On a phone it is unreadable and it buries the one sentence that
 * matters, so reduce it to the instruction and drop the box.
 */
export function summarisePdfError(error) {
  const message = String(error?.message ?? error ?? '');

  if (error?.code === 'PLAYWRIGHT_MISSING') {
    return 'Playwright is not installed on the machine running this. Run `npm install` in pm-agent.';
  }
  if (/Executable doesn't exist|playwright install/i.test(message)) {
    return "the browser is not installed on the machine running this. Run `npx playwright install chromium` in pm-agent (add `--with-deps` on Linux).";
  }

  // Anything else: first line only, so an unexpected fault is still diagnosable.
  return message.split('\n')[0].slice(0, 200);
}
