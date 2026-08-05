/**
 * Where the Project Ledger lives on disk.
 *
 * One folder per project. The layout is deliberately boring and human-readable:
 * when the automation breaks at 7am you must be able to open the files in any
 * editor and see the truth.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, '../..');

/** Repo-level default; override with LEDGER_ROOT to keep the ledger private. */
export function ledgerRoot() {
  return process.env.LEDGER_ROOT
    ? path.resolve(process.env.LEDGER_ROOT)
    : path.resolve(packageRoot, '..', 'projects');
}

export function projectRoot(projectCode) {
  return path.join(ledgerRoot(), projectCode);
}

export function projectPaths(projectCode) {
  const root = projectRoot(projectCode);
  return {
    root,

    contract: path.join(root, '00-contract'),
    clauseIndex: path.join(root, '00-contract', 'clause-index.yaml'),

    programme: path.join(root, '01-programme'),
    xer: path.join(root, '01-programme', 'xer'),
    parsed: path.join(root, '01-programme', 'parsed'),
    baseline: path.join(root, '01-programme', 'baseline'),

    ledger: path.join(root, '02-ledger'),
    diary: path.join(root, '02-ledger', 'diary.md'),
    progress: path.join(root, '02-ledger', 'progress.yaml'),
    decisions: path.join(root, '02-ledger', 'decisions.yaml'),
    events: path.join(root, '02-ledger', 'events.yaml'),
    // Committed, not transient: a record of what was flagged and when.
    alerts: path.join(root, '02-ledger', 'alerts.yaml'),

    registers: path.join(root, '03-registers'),
    rfi: path.join(root, '03-registers', 'rfi.yaml'),
    submittals: path.join(root, '03-registers', 'submittals.yaml'),
    vo: path.join(root, '03-registers', 'vo.yaml'),
    ncr: path.join(root, '03-registers', 'ncr.yaml'),
    risk: path.join(root, '03-registers', 'risk.yaml'),
    procurement: path.join(root, '03-registers', 'procurement.yaml'),
    actions: path.join(root, '03-registers', 'actions.yaml'),

    evidence: path.join(root, '04-evidence'),
    photos: path.join(root, '04-evidence', 'photos'),
    correspondence: path.join(root, '04-evidence', 'correspondence'),
    minutes: path.join(root, '04-evidence', 'minutes'),
    drawings: path.join(root, '04-evidence', 'drawings'),
    documents: path.join(root, '04-evidence', 'documents'),
    // A register of every document received, wherever it was filed.
    documentIndex: path.join(root, '02-ledger', 'documents.yaml'),

    commercial: path.join(root, '05-commercial'),
    valuations: path.join(root, '05-commercial', 'valuations'),
    cashflow: path.join(root, '05-commercial', 'cashflow.yaml'),
    subcontracts: path.join(root, '05-commercial', 'subcontracts'),

    outputs: path.join(root, '06-outputs'),
    reports: path.join(root, '06-outputs', 'reports'),
    claims: path.join(root, '06-outputs', 'claims'),
    notices: path.join(root, '06-outputs', 'notices'),
    p6updates: path.join(root, '06-outputs', 'p6-updates'),

    projectBrief: path.join(root, 'CLAUDE.md'),
    config: path.join(root, 'project.yaml'),
    // Per-project override of <LEDGER_ROOT>/brand.yaml, for reporting under a
    // joint venture name or a client's own template.
    brand: path.join(root, 'report-brand.yaml'),
  };
}

