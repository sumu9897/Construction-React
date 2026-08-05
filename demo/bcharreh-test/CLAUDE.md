# Bcharreh Heritage Houses (BCHARREH-TEST)

> **FICTIONAL TEST DATA.** This project exists to practise with the PM agent.
> Names, sums, dates and events are invented. Do not reuse in real
> correspondence.

Project brief for Claude. Everything in this file is treated as authoritative
context for every skill that touches this project.

## Parties

| Role | Organisation | Primary contact |
|---|---|---|
| Employer / Client | Choueiri family estate | Mr. Pierre Choueiri |
| Engineer / Consultant | Salameh Engineering | Eng. Malek Salameh |
| Main contractor | PMCC S.A.R.L. | Eng. Youssef Assi (PM) |
| Our role on this project | **contractor** | |

## Contract

- **Form:** Bespoke lump-sum renovation agreement, Lebanese law (test data)
- **Contract sum:** USD 1,450,000 (test figure)
- **Commencement date:** 2 March 2026
- **Contract completion date:** 27 November 2026
- **Liquidated damages:** USD 1,500/day, capped at 5% of the contract sum
- **Retention:** 10%, half released at practical completion, half at 12 months
- **Notice period for delay events:** 14 days from awareness (Art. 9.2)
- **Response period for RFIs:** 7 days (Art. 5.4)
- **Response period for submittals:** 14 days (Art. 5.5)

> These periods drive the SLA clocks in the registers and the notice
> deadlines the agent chases. Art. 9.2 also requires particulars within
> 28 days of the notice.

## The works

Repair and renovation of two adjoining heritage stone houses in Bcharreh:
roof strip and re-tile in handmade terracotta, stone repairs and lime
repointing, new structural steel ties and lintels to House A, full joinery
restoration off-site, MEP renewal throughout, lime plaster internally,
terraced external works. Heritage constraints: lime mortars only, tile and
stone samples require Client and Consultant approval before bulk work.

## Programme

- Master programme is **Microsoft Project**; XML exports land in `01-programme/xer/`.
- Baseline XML lives in `01-programme/baseline/`.
- MS Project is the system of record for the schedule. The agent proposes
  updates as importable files in `06-outputs/p6-updates/`; it never rewrites
  the source programme.

## Conventions

- Dates are stored ISO (YYYY-MM-DD). Prose may use "12 Aug 2026".
- Delay responsibility is recorded as answered by a human, never inferred.
- Unmeasured progress is reported as "not measured", never estimated.
