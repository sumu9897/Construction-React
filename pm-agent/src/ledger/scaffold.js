/**
 * Create a new project Ledger, seeded with empty registers and a project brief.
 */

import path from 'node:path';
import { projectPaths } from './paths.js';
import { ensureDir, exists, writeYaml, appendMarkdown } from './store.js';
import { writeFile } from 'node:fs/promises';
import { today } from '../util/dates.js';

const EMPTY_REGISTERS = [
  ['rfi', 'RFI register - one entry per request for information'],
  ['submittals', 'Submittal / shop drawing register'],
  ['vo', 'Variation order register'],
  ['ncr', 'Non-conformance and snag register'],
  ['risk', 'Risk register'],
  ['procurement', 'Procurement and long-lead tracker'],
  ['actions', 'Action register - who owes what by when'],
];

const PROJECT_BRIEF = (code, name) => `# ${name} (${code})

Project brief for Claude. Everything in this file is treated as authoritative
context for every skill that touches this project. Keep it accurate - the
clause-citing use cases will be confidently wrong if the contract form is wrong.

## Parties

| Role | Organisation | Primary contact |
|---|---|---|
| Employer / Client | _TBC_ | _TBC_ |
| Engineer / Consultant | _TBC_ | _TBC_ |
| Main contractor | _TBC_ | _TBC_ |
| Our role on this project | **_contractor \\| pmc \\| client-side_** | |

## Contract

- **Form:** _e.g. FIDIC Red Book 1999, FIDIC Yellow 2017, bespoke_
- **Contract sum:** _TBC_
- **Commencement date:** _TBC_
- **Contract completion date:** _TBC_
- **Liquidated damages:** _rate and cap_
- **Retention:** _percentage and release terms_
- **Notice period for delay events:** _e.g. 28 days from awareness (Cl. 20.1)_
- **Response period for RFIs:** _e.g. 14 days_
- **Response period for submittals:** _e.g. 21 days_

> These periods drive the SLA clocks in the RFI/submittal register and the
> notice deadlines the agent will chase you about. Fill them in.

## Programme

- Master programme is Primavera P6 (\`.xer\`) or Microsoft Project (\`.xml\`,
  via File → Save As → XML - never \`.mpp\`). Exports land in \`01-programme/xer/\`.
- The baseline export lives in \`01-programme/baseline/\`.
- P6 is the system of record for the schedule. The agent proposes updates as
  importable files in \`06-outputs/p6-updates/\`; it never rewrites the XER.

## Conventions

- Dates are stored ISO (YYYY-MM-DD). Prose may use "12 Aug 2026".
- Every ledger write is committed to git immediately. Do not amend history.
- Nothing is sent to a client, engineer, or subcontractor automatically.
  The agent drafts; a human sends.
`;

const DIARY_HEADER = (code, name) => `# Site Diary - ${name} (${code})

Contemporaneous record. Entries are append-only and committed to git on the day
they are made. Do not backdate or rewrite entries; add a correcting entry
instead, so the history stands up as evidence.
`;

export async function scaffoldProject(code, { name = code, force = false } = {}) {
  const paths = projectPaths(code);

  if ((await exists(paths.root)) && !force) {
    throw new Error(`Project ${code} already exists at ${paths.root} (use --force to re-seed)`);
  }

  const directories = [
    paths.contract,
    paths.xer,
    paths.parsed,
    paths.baseline,
    paths.ledger,
    paths.registers,
    paths.photos,
    paths.correspondence,
    paths.minutes,
    paths.valuations,
    paths.subcontracts,
    paths.reports,
    paths.claims,
    paths.notices,
    paths.p6updates,
  ];

  for (const dir of directories) await ensureDir(dir);

  // Keep otherwise-empty evidence folders in git so the structure survives a
  // fresh clone.
  for (const dir of [paths.photos, paths.correspondence, paths.minutes, paths.baseline]) {
    const keep = path.join(dir, '.gitkeep');
    if (!(await exists(keep))) await writeFile(keep, '', 'utf8');
  }

  for (const [key, description] of EMPTY_REGISTERS) {
    if (await exists(paths[key])) continue;
    await writeYaml(paths[key], { nextRef: 1, entries: [] }, { header: description });
  }

  if (!(await exists(paths.progress))) {
    await writeYaml(
      paths.progress,
      { project: code, updatedAt: null, activities: {} },
      { header: 'Progress captured from site, keyed by P6 activity code' },
    );
  }

  if (!(await exists(paths.events))) {
    await writeYaml(
      paths.events,
      { nextRef: 1, entries: [] },
      { header: 'Delay and disruption events - the raw material of every EOT claim' },
    );
  }

  if (!(await exists(paths.decisions))) {
    await writeYaml(
      paths.decisions,
      { nextRef: 1, entries: [] },
      { header: 'Decisions required, who owes them, and by when' },
    );
  }

  if (!(await exists(paths.diary))) {
    await appendMarkdown(paths.diary, DIARY_HEADER(code, name));
  }

  if (!(await exists(paths.projectBrief))) {
    await writeFile(paths.projectBrief, PROJECT_BRIEF(code, name), 'utf8');
  }

  if (!(await exists(paths.config))) {
    await writeYaml(
      paths.config,
      {
        code,
        name,
        role: 'contractor',
        createdAt: today(),
        // What the agent measures this project against. Anything left null is
        // reported as not watched rather than quietly skipped - see /contract.
        // The clause fields are optional and are cited verbatim where set, so a
        // letter quotes your contract's numbering rather than a generic form.
        contract: {
          form: null,
          sum: null,
          currency: 'USD',
          completionDate: null,
          ldPerDay: null,
          ldCapPercent: null,
          retentionPercent: null,
          delayNoticeDays: 28,
          particularsDays: 42,
          rfiResponseDays: 14,
          submittalResponseDays: 21,
          delayNoticeClause: null,
          particularsClause: null,
          ldClause: null,
          rfiClause: null,
          submittalClause: null,
        },
        chase: {
          // How far ahead to look for activities about to become a problem.
          lookaheadDays: 14,
          nearCriticalFloatDays: 10,
          // Cap questions per session. A 40-question interrogation at 7am gets
          // ignored; five good questions get answered.
          maxQuestionsPerSession: 6,
        },
        telegram: { chatId: null },
      },
      { header: `Project configuration for ${code}` },
    );
  }

  return paths;
}
