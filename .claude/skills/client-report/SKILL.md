---
name: client-report
description: Produce a weekly or monthly client progress report from the Project Ledger — executive summary, progress, critical path, risks, decisions required, and commercial position. Trigger on "client report", "monthly report", "weekly report", "progress report", "board update", "report pack", "employer's report", "steering update", or any request to report project status to a client, employer, board, or lender.
---

# Client report

The perceived quality of a project manager is largely the quality of their reporting.
This produces a report that is internally consistent because everything in it comes
from one source, and on time because it takes minutes.

## The weekly report is generated, not written

```bash
cd pm-agent
node bin/pm.js report <CODE> --pdf
```

That produces the whole document — letterhead, KPIs, S-curve, critical path,
decisions required, risks, and the appendices — from the Ledger, with provenance on
every figure. Run it first. Do not hand-write a report that the tool already builds,
and do not reach for the `pdf` skill: it manipulates existing PDFs and cannot create
a styled one.

**Your job is the part the generator cannot do**: read the output and decide whether
it tells the truth well. Specifically —

- Is the executive story right? The generator ranks by float and lateness; you know
  whether the thing at the top is actually what matters this week.
- Are the `consequence` fields on decisions written in terms the client feels? "Blocks
  slab handover" beats "delays A-1300".
- Do the risk mitigations describe something actually in train, or aspiration?
- Does anything read as an accusation rather than a fact?

Edit the source data in the Ledger and regenerate. Do not hand-edit the HTML — it
will be overwritten and the next report will regress.

## For a monthly, board or ad-hoc report

There is no monthly variant yet. Compose it from the same sources:

```bash
node bin/pm.js diff <CODE>        # what moved since last report
node bin/pm.js exceptions <CODE>  # what is at risk now
node bin/pm.js health <CODE>      # only if a new programme was submitted
```

Then read, from `<LEDGER_ROOT>/<CODE>/`:

| Section | Source |
|---|---|
| Contract, parties, role | `CLAUDE.md`, `project.yaml` |
| Progress narrative | `02-ledger/diary.md`, `02-ledger/progress.yaml` |
| Delay events | `02-ledger/events.yaml` |
| Decisions outstanding | `02-ledger/decisions.yaml` |
| Registers | `03-registers/*.yaml` |
| Photos | `04-evidence/photos/index.yaml` |
| Commercial | `05-commercial/` |

## Structure

1. **Executive summary** — four sentences maximum. Where the project stands, whether
   the completion date moved, the single biggest risk, and what you need from the
   reader. If it takes more than four sentences you have not decided what matters.
2. **Progress this period** — by work package, against the programme. Percentages
   only where they are measured, never estimated to fill the table.
3. **Programme position** — current forecast completion vs contract completion, and
   the movement since the last report. Critical path in plain English.
4. **Risks and dependencies** — from `risk.yaml`, each with owner, impact and the
   mitigation actually in train. Say what happens if nothing is done.
5. **Decisions required from the reader** — the most important section and the one
   most reports omit. Each item: what is needed, from whom, by when, and the
   consequence of it being late. This is what separates a project manager from a
   reporter.
6. **Commercial** — variations, payment position, cashflow, only if the data exists.
7. **Photos** — a small selection that supports the narrative, captioned with location
   and date.

## Rules

- **Never invent a number.** If measured progress is not in the Ledger, write "not
  measured this period" and flag it. A fabricated percentage in a client report is
  worse than an admitted gap.
- **Never soften a slip.** If the date moved, the executive summary says so in the
  first two sentences. Burying it destroys the credibility of every future report.
- **Attribute delay events factually**, using the responsibility recorded in
  `events.yaml`. Do not upgrade "unclassified" into a claim, and do not quietly drop
  employer-caused events to keep the tone pleasant.
- **The user sends it, not you.** Produce the draft into `06-outputs/reports/`. Never
  email, post, or transmit it anywhere.

## Output

The weekly writes itself to
`<LEDGER_ROOT>/<CODE>/06-outputs/reports/YYYY-MM-DD-weekly-report-NN.{html,pdf}` and
commits.

For the report types that have no generator yet, write Markdown alongside it and use
the `docx` or `pptx` skills if the user needs another format. Never use the `pdf`
skill to build a report from scratch — it cannot style one.

## Before you hand it over

Run through the warnings the command prints. They are not cosmetic:

- Missing brand contact details mean a client document with a blank footer.
- A stale programme data date means every date in the report is computed from old
  logic — say so to the client rather than letting them assume it is current.
- "Page 1 is Nmm tall against a 265mm printable area" means the one-page summary has
  spilled onto a second sheet. Cut content; do not shrink the type.
