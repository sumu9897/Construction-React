---
name: programme-review
description: Review a Primavera P6 programme update — what changed, whether the revision is honest, and what it means for the completion date. Trigger when the user mentions a P6 update, XER file, programme revision, schedule submission, baseline acceptance, "what changed in the programme", DCMA check, schedule health, critical path, float erosion, or asks whether a contractor's revised programme should be accepted.
---

# Programme review

You are reviewing a P6 programme update. The tooling does the arithmetic; you supply
the judgement and the sentence that wins the meeting.

## Run the tools first, always

```bash
cd pm-agent
node bin/pm.js ingest <CODE> <path/to/update.xer>   # archives + parses
node bin/pm.js diff <CODE>                          # vs the previous update
node bin/pm.js health <CODE>                        # DCMA 14-point
```

Never eyeball an XER or a Gantt PDF and reason from it. Parse it. The whole point is
that the changes that matter are invisible by eye.

## What to look for, in order

1. **Did the completion date move?** Start here. Everything else is context for this.
2. **If it did not move but float went negative, be suspicious.** Work slipped and the
   end date held — something absorbed it. Look for a hard constraint added, a logic
   link removed, or a duration cut. The diff flags this combination explicitly.
3. **Logic removed** is the least visible and most consequential change. A removed link
   means an activity no longer waits for something it used to wait for. Ask why.
4. **Lags stretched** achieve the same thing more quietly.
5. **Durations cut with no progress behind them.** The diff marks these `unsupported`.
   A 25-day activity becoming 19 days while percent complete stands still is a claim
   about productivity that needs evidence.
6. **Incomplete activities deleted.** Scope does not vanish; it moved somewhere or it
   was dropped. Find out which.
7. **Hard constraints added.** These override logic and are how a programme is made to
   show a date it cannot actually achieve.

## How to report it

Lead with the answer, then the evidence:

> Completion holds at 18 Dec on paper, but A-1240 has gone 3 days negative and a
> Mandatory Finish constraint was added to the completion milestone in this revision.
> The date is being held by the constraint, not by the logic. On the unconstrained
> logic the finish is 21 Dec.

Then the specific questions to put to whoever submitted it. Be concrete — quote
activity IDs and the before/after values from the diff. Vague concerns get deflected;
"why was A-1400 → M-9000 removed" does not.

## Role matters

Read `<LEDGER_ROOT>/<CODE>/CLAUDE.md` for which side of the table you are on.

- **PMC or client-side:** this is an interrogation. Your output is a list of queries
  and a recommendation to accept, accept-with-comment, or reject.
- **Main contractor:** this is a pre-submission check. Anything the diff flags, the
  Engineer will also find. Fix it or prepare the justification before you submit.

## Rules

- Never conclude entitlement. You describe what changed; whether it gives rise to a
  claim is a contractual judgement against the specific contract form.
- Distinguish what the data shows from what you infer. "Logic was removed" is a fact.
  "To mask the slip" is an inference and must be labelled as one.
- If the programme has no baseline ingested, say so — most of DCMA and every variance
  statement is meaningless without one.
