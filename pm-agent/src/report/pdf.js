/**
 * HTML to PDF via headless Chromium.
 *
 * Playwright is deliberately NOT a dependency of this package. `pm report` always
 * emits self-contained HTML with zero extra install - that HTML opens in any
 * browser, prints with Cmd+P, and emails as a single file. Only `--pdf` needs a
 * browser, and it says so clearly rather than failing with a module-not-found.
 *
 * `page.pdf()` rather than Chrome's `--print-to-pdf` CLI: the CLI cannot do
 * printBackground, which would silently strip every tinted panel, status pill and
 * chart wash in the report.
 */

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { sansDataUri } from './html/fonts.js';

const INSTALL_HINT = `Playwright is needed to write a PDF.

    cd pm-agent
    npm install --save-dev playwright
    npx playwright install chromium

The HTML report was still written and can be printed from any browser
(Cmd+P, then "Save as PDF" — choose A4 and enable background graphics).`;

/**
 * Resolve Playwright without making it a hard dependency. Also checks the global
 * install, which is how it is present in some CI and container images.
 */
async function loadPlaywright() {
  const candidates = ['playwright', 'playwright-core'];
  const attempts = [...candidates];

  // Also try a global install: ESM `import` does not consult NODE_PATH, so a
  // globally-installed playwright has to be addressed by file URL.
  const globalRoots = (process.env.NODE_PATH ?? '').split(path.delimiter).filter(Boolean);
  for (const root of globalRoots) {
    for (const name of candidates) {
      attempts.push(pathToFileURL(path.join(root, name, 'index.js')).href);
    }
  }

  for (const specifier of attempts) {
    try {
      const module = await import(specifier);
      // Playwright is CommonJS. Imported by bare name Node synthesises named
      // exports, but imported by file URL it may only expose `default`.
      const resolved = module.chromium ? module : module.default;
      if (resolved?.chromium) return resolved;
    } catch {
      // try the next candidate
    }
  }

  const error = new Error(INSTALL_HINT);
  error.code = 'PLAYWRIGHT_MISSING';
  throw error;
}

/** Whether a PDF can actually be produced on this machine. Used by `pm doctor`. */
export async function playwrightAvailable() {
  return (await pdfCapability()).ok;
}

/**
 * Why a PDF can or cannot be produced here.
 *
 * The module importing is not the question - the question is whether a browser
 * will launch. Those are two different installs (`npm install`, then
 * `playwright install chromium`), and having the first without the second is the
 * common state on a fresh machine. A check that stops at the import reports
 * "available" on exactly the machine that cannot render a report, which is worse
 * than no check at all.
 *
 * @returns {Promise<{ok: boolean, reason: string|null, fix: string|null}>}
 */
export async function pdfCapability() {
  let playwright;
  try {
    playwright = await loadPlaywright();
  } catch {
    return {
      ok: false,
      reason: 'Playwright is not installed - reports will be HTML only',
      fix: 'npm install (in pm-agent)',
    };
  }

  // executablePath() is a pure path computation - it does not check the disk, and
  // it throws when the channel has no bundled browser at all.
  let executable;
  try {
    executable = playwright.chromium.executablePath();
  } catch (error) {
    return { ok: false, reason: `no bundled browser: ${error.message.split('\n')[0]}`, fix: 'npx playwright install chromium' };
  }

  const { existsSync } = await import('node:fs');
  if (!executable || !existsSync(executable)) {
    return {
      ok: false,
      reason: `browser not downloaded (expected at ${executable})`,
      fix: `npx playwright install${process.platform === 'linux' ? ' --with-deps' : ''} chromium`,
    };
  }

  return { ok: true, reason: null, fix: null };
}

function footerTemplate(model, brand, fontUri) {
  const face = fontUri
    ? `@font-face{font-family:'IBM Plex Sans';src:url(${fontUri}) format('woff2');font-weight:100 700;}`
    : '';

  const left = [brand.company.name, model.meta.name, `Report No. ${model.meta.reportNo}`]
    .filter(Boolean)
    .join(' &middot; ');

  return `<style>${face}</style>
  <div style="
    font-family:'IBM Plex Sans',Arial,sans-serif;
    font-size:7pt; color:${brand.colours.muted};
    width:100%; padding:0 ${brand.page.marginSideMm}mm;
    display:flex; justify-content:space-between; align-items:center;">
    <span style="display:flex; align-items:center;">
      <span style="display:inline-block; width:10px; height:3px; background:${brand.colours.accent}; margin-right:7px;"></span>
      ${left}
    </span>
    <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
  </div>`;
}

/**
 * @param {string} html      self-contained document
 * @param {string} outFile   destination .pdf
 * @param {object} model     used for the footer
 * @param {object} brand     page setup and colours
 * @returns {Promise<{file: string, pages: number|null}>}
 */
export async function htmlToPdf(html, outFile, model, brand) {
  const { chromium } = await loadPlaywright();
  const fontUri = await sansDataUri();

  const browser = await chromium.launch({
    // Required in containers; harmless on macOS.
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    // Everything - fonts, logo, photographs - is a data URI, so there is nothing
    // to wait on the network for.
    await page.setContent(html, { waitUntil: 'load' });
    await page.emulateMedia({ media: 'print' });

    const buffer = await page.pdf({
      format: brand.page.size === 'Letter' ? 'Letter' : 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      // An empty header keeps the top margin without printing a running head over
      // the letterhead on page 1.
      headerTemplate: '<div></div>',
      footerTemplate: footerTemplate(model, brand, fontUri),
      margin: {
        top: `${brand.page.marginTopMm}mm`,
        bottom: `${brand.page.marginBottomMm}mm`,
        left: `${brand.page.marginSideMm}mm`,
        right: `${brand.page.marginSideMm}mm`,
      },
    });

    await writeFile(outFile, buffer);
    return { file: outFile, pages: countPages(buffer) };
  } finally {
    await browser.close();
  }
}

/** Page count straight from the PDF page tree, for the verification step. */
function countPages(buffer) {
  const text = buffer.toString('latin1');
  const counts = [...text.matchAll(/\/Type\s*\/Page[^s]/g)].length;
  return counts > 0 ? counts : null;
}

/**
 * Render the document to PNG at print width.
 *
 * A report template cannot be verified by asserting on HTML strings - you have to
 * look at it. This exists so the layout can be eyeballed for collisions, clipping
 * and orphaned headings.
 */
export async function htmlToPng(html, outFile, options = {}) {
  const { widthMm = 210, marginSideMm = 14, scale = 2, selector = null, index = 0 } = options;
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });

  const mmToPx = (mm) => Math.round((mm / 25.4) * 96);

  try {
    const page = await browser.newPage({
      // Match the PDF's content box, so what is measured here is what prints.
      viewport: { width: mmToPx(widthMm - marginSideMm * 2), height: mmToPx(297) },
      deviceScaleFactor: scale,
    });
    await page.setContent(html, { waitUntil: 'load' });
    await page.emulateMedia({ media: 'print' });

    let heightMm = null;

    if (selector) {
      const target = page.locator(selector).nth(index);
      await target.screenshot({ path: outFile });
      const box = await target.boundingBox();
      heightMm = box ? Math.round((box.height / 96) * 25.4) : null;
    } else {
      await page.screenshot({ path: outFile, fullPage: true });
    }

    // Anything wider than the content box gets silently cropped by the PDF, and
    // a table losing its last column is the kind of defect nobody notices until
    // a client does. Measured, not eyeballed.
    const overflow = await page.evaluate(() => {
      const limit = document.documentElement.clientWidth;
      return [...document.querySelectorAll('table, .cols, .strip, .band, .photos, svg')]
        .filter((el) => el.getBoundingClientRect().right > limit + 0.5)
        .map((el) => `${el.tagName.toLowerCase()}.${el.className}`)
        .slice(0, 8);
    });

    return { file: outFile, heightMm, overflow };
  } finally {
    await browser.close();
  }
}

/** Usable content height for a page size, in mm. Page 1 must fit inside this. */
export function contentHeightMm(brand) {
  const total = brand.page.size === 'Letter' ? 279 : 297;
  return total - brand.page.marginTopMm - brand.page.marginBottomMm;
}

/**
 * Inspect how text is encoded in a generated PDF.
 *
 * `type3` is the failure mode worth watching: Chromium emits Type3 glyph
 * procedures when it cannot subset a font (notably any instance of a variable
 * font). The page still looks right, so this is invisible on screen - but the
 * text stops being selectable or searchable and the file roughly doubles.
 */
export function inspectFonts(buffer, family = 'IBMPlex') {
  const text = buffer.toString('latin1');
  const baseFonts = [...new Set([...text.matchAll(/\/BaseFont\s*\/([A-Za-z0-9+-]+)/g)].map((m) => m[1]))];

  return {
    embeddedPrograms: (text.match(/\/FontFile\d?/g) ?? []).length,
    type3: (text.match(/\/Type3/g) ?? []).length,
    baseFonts,
    hasFamily: baseFonts.some((name) => name.includes(family)),
    // A subset prefix (ABCDEF+) is the marker of a genuinely embedded subset.
    subsetted: baseFonts.some((name) => /^[A-Z]{6}\+/.test(name)),
  };
}
