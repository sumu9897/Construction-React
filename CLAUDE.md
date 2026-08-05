# Repository guide

This repository holds two unrelated things. Do not mix them.

## 1. `src/`, `index.html`, `vite.config.js` — the marketing website

A static React 18 + Vite + Tailwind brochure site (MS Builders / PMCC). Single page,
no router, no backend. Content lives in `src/export.js`; sections in `src/sections/`.

```bash
npm run dev
npm run build
npm run lint
```

## 2. `pm-agent/` — construction project automation

A Project Ledger, a Primavera P6 XER parser, and a Telegram agent that chases site
updates against the programme. Node, ESM, one dependency, its own `package.json` and
test suite. Nothing here imports from the website and the website imports nothing from
here.

```bash
cd pm-agent && npm install && npm test
```

See `pm-agent/README.md`. The design rationale — why the Ledger is git-backed files,
why the agent never writes to P6, why nothing is ever sent without a human — is in
that README and matters more than the code.

## 3. `.claude/skills/` — the judgement layer

`programme-review`, `client-report`, `delay-notice`, `lookahead`. These sit on top of
the `pm-agent` CLI: the CLI does the arithmetic deterministically, the skills supply
the reading of it. When working on a project, read that project's own `CLAUDE.md` in
the Ledger first — it states the contract form, and the clause-citing behaviour is
wrong without it.

## Rules that apply to the whole repo

- **The Project Ledger never gets committed here.** It holds contract sums, rates and
  claims strategy. It lives in its own private repo via `LEDGER_ROOT`; `/projects/` is
  gitignored as a backstop.
- **Nothing is sent externally by automation.** No email, no client message, no
  contractual notice. Draft to `06-outputs/`, and a human sends it.
- **Never infer entitlement.** Delay responsibility is recorded as answered by a
  human, never derived from keywords.
- **Never fabricate a measurement.** If progress is not in the Ledger, the output says
  "not measured", not a plausible number. These figures end up in payment
  applications. The same rule governs generated correspondence: an unrecorded
  consequence is omitted from a chase letter, never invented.
- **Anything that reads the Ledger with an LLM is read-only.** `src/bot/ask.js` runs
  Claude with a tool allowlist plus a redundant deny list, and never the
  permission-bypass flags. An agent that could edit the Ledger could rewrite the
  contemporaneous record the system exists to protect.
- **Alerts are quiet and are part of the record.** Each condition fires once and stays
  silent until it materially worsens; `02-ledger/alerts.yaml` is committed, because
  "you were warned on this date" is itself evidence.
