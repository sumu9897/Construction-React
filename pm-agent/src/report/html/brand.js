/**
 * Brand configuration for client-facing reports.
 *
 * Resolution order, later overriding earlier:
 *   1. built-in defaults (below)
 *   2. <LEDGER_ROOT>/brand.yaml
 *   3. <LEDGER_ROOT>/<CODE>/report-brand.yaml
 *
 * So you fill it in once globally, and override per project only when you report
 * under a joint venture name or a client's own template.
 */

import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { readYaml, exists } from '../../ledger/store.js';
import { ledgerRoot, projectPaths } from '../../ledger/paths.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const BRAND_EXAMPLE = path.resolve(here, '../../../report-assets/brand.example.yaml');

/** Derived from the website, toned down for print. See brand.example.yaml. */
export const DEFAULTS = {
  company: { name: 'PMCC', descriptor: null, logo: null, logoHeightMm: 14 },
  contact: { address: null, phone: null, email: null, website: null },
  issuer: { name: null, title: null },
  confidentiality: 'Commercial in confidence. Issued for the information of the addressee only.',
  colours: {
    ink: '#2D2A2A',
    body: '#4B5563',
    muted: '#6B7280',
    rule: '#E5E7EB',
    panel: '#F9FAFB',
    accent: '#EAB308',
    green: '#15803D',
    amber: '#B45309',
    red: '#B91C1C',
    // The masthead band: the website's charcoal-and-bone, carried into print.
    band: '#241F1B',
    bone: '#F4EFE6',
    boneMuted: 'rgba(244, 239, 230, 0.66)',
  },
  page: { size: 'A4', marginTopMm: 16, marginBottomMm: 16, marginSideMm: 14 },
};

/** Shallow-merge one level deep, which is all this config shape needs. */
function merge(base, override) {
  if (!override) return base;
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === null || value === undefined) continue;
    result[key] =
      typeof value === 'object' && !Array.isArray(value) && typeof base[key] === 'object'
        ? { ...base[key], ...value }
        : value;
  }
  return result;
}

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

/**
 * Read an image and return a data URI. Returns null rather than throwing when the
 * file is missing - a broken logo path must not stop a report going out on a
 * Friday afternoon; it degrades to the company name set in type.
 */
export async function embedImage(file) {
  if (!file) return null;
  if (!(await exists(file))) return null;

  const ext = path.extname(file).toLowerCase();
  const mime = MIME[ext];
  if (!mime) return null;

  const base64 = (await readFile(file)).toString('base64');
  return `data:${mime};base64,${base64}`;
}

/**
 * @param {string} projectCode
 * @returns {Promise<object>} brand config with `logoDataUri` and `warnings` resolved
 */
export async function loadBrand(projectCode) {
  const warnings = [];

  const globalFile = path.join(ledgerRoot(), 'brand.yaml');
  const projectFile = projectPaths(projectCode).brand;

  const globalConfig = await readYaml(globalFile);
  const projectConfig = await readYaml(projectFile);

  if (!globalConfig && !projectConfig) {
    warnings.push(
      `No brand config found. Copy ${path.relative(process.cwd(), BRAND_EXAMPLE)} to ${globalFile} and fill it in.`,
    );
  }

  const brand = merge(merge(DEFAULTS, globalConfig), projectConfig);

  // Logo paths are relative to the file that declared them, which is what anyone
  // editing the yaml would expect.
  let logoDataUri = null;
  if (brand.company.logo) {
    const declaredIn = projectConfig?.company?.logo ? projectFile : globalFile;
    const resolved = path.resolve(path.dirname(declaredIn), brand.company.logo);
    logoDataUri = await embedImage(resolved);
    if (!logoDataUri) warnings.push(`Logo not found or unsupported format: ${resolved}`);
  }

  // These end up printed on a document going to a client. Missing contact details
  // are a real defect, not a cosmetic one, so say so every time rather than
  // quietly rendering a blank footer.
  const contactSet = Object.values(brand.contact).some(Boolean);
  if (!contactSet) {
    warnings.push('No contact details set in brand config - the report footer will be blank.');
  }
  if (!brand.issuer.name) {
    warnings.push('No issuer name set in brand config - the letterhead will omit "Issued by".');
  }

  return { ...brand, logoDataUri, warnings };
}
