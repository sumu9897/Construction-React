/**
 * Base64-inline the report typefaces.
 *
 * Not an optimisation - a hard requirement. This environment has no professional
 * fonts installed and `fc-match` resolves every serif request to DejaVu *Sans*, so an
 * un-embedded font does not fail loudly, it silently renders the body copy in the
 * wrong classification. A Mac mini has a different set again. Embedding is the only
 * way the client sees what you designed.
 */

import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { exists } from '../../ledger/store.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const FONT_DIR = path.resolve(here, '../../../report-assets/fonts');

/**
 * IBM Plex: engineering heritage, open licence, and - the reason it was chosen over
 * a prettier face - real tabular figures. Every table in this report is dates and
 * percentages, and proportional digits make columns of numbers unreadable.
 */
/**
 * Static instances, deliberately NOT the variable font.
 *
 * Chromium cannot emit a TrueType subset for an instance of a variable font, so
 * it falls back to Type3 glyph procedures: the report still *looks* right, but
 * the PDF text becomes unselectable and unsearchable, and the file roughly
 * doubles. Three static weights produce properly embedded, subsetted TrueType.
 */
const FACES = [
  { file: 'ibm-plex-sans-400.woff2', family: 'IBM Plex Sans', weight: '400', style: 'normal' },
  { file: 'ibm-plex-sans-500.woff2', family: 'IBM Plex Sans', weight: '500', style: 'normal' },
  { file: 'ibm-plex-sans-600.woff2', family: 'IBM Plex Sans', weight: '600', style: 'normal' },
  // Fraunces carries the brand voice from the website into print. Display sizes
  // only - project name, hero figures, appendix titles - never body copy, because
  // its proportional digits would wreck a column of dates.
  { file: 'fraunces-400.woff2', family: 'Fraunces', weight: '400', style: 'normal' },
  { file: 'fraunces-600.woff2', family: 'Fraunces', weight: '600', style: 'normal' },
];

/** The stack used when a face is missing. Named so the failure is diagnosable. */
export const FALLBACK_SANS = "'Liberation Sans', 'Helvetica Neue', Arial, sans-serif";
export const FALLBACK_SERIF = "'Liberation Serif', 'Times New Roman', Times, serif";

/**
 * The sans as a bare data URI.
 *
 * Chromium renders page header/footer templates in an isolated context with no
 * access to the document's stylesheet, so the footer needs its own copy of the
 * font declaration or it falls back to a system face and the page numbers stop
 * matching the document.
 */
export async function sansDataUri() {
  const file = path.join(FONT_DIR, FACES[0].file);
  if (!(await exists(file))) return null;
  return `data:font/woff2;base64,${(await readFile(file)).toString('base64')}`;
}

/**
 * @returns {Promise<{css: string, embedded: string[], missing: string[]}>}
 */
export async function fontFaceCss() {
  const blocks = [];
  const embedded = [];
  const missing = [];

  for (const face of FACES) {
    const file = path.join(FONT_DIR, face.file);

    if (!(await exists(file))) {
      missing.push(face.file);
      continue;
    }

    const base64 = (await readFile(file)).toString('base64');
    blocks.push(
      [
        '@font-face {',
        `  font-family: '${face.family}';`,
        `  font-style: ${face.style};`,
        `  font-weight: ${face.weight};`,
        // block, not swap: this is a print document rendered headlessly. A swap
        // would risk the PDF being captured mid-fallback.
        '  font-display: block;',
        `  src: url(data:font/woff2;base64,${base64}) format('woff2');`,
        '}',
      ].join('\n'),
    );
    embedded.push(face.file);
  }

  return { css: blocks.join('\n\n'), embedded, missing };
}
