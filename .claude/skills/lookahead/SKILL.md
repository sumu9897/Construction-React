---
name: lookahead
description: Build a constraint-checked 3 or 6 week look-ahead — every activity marked Ready or Blocked with the blocking reason named. Trigger on "look-ahead", "lookahead", "3 week programme", "6 week programme", "weekly work plan", "what's coming up", "what can we actually start", "readiness review", "constraint analysis", or planning the next few weeks of site work.
---

# Constraint-checked look-ahead

A normal look-ahead says "these 40 activities start in three weeks". That is a
restatement of the programme and it prevents nothing. This one says which of them can
actually start, and names what is stopping the rest.

That difference is the whole value: it converts a schedule into an action list, and it
is the discipline that prevents delay rather than documenting it afterwards.

## Build it

```bash
cd pm-agent
node bin/pm.js exceptions <CODE> --limit 50
```

That gives the activities in the window and their float. Then, for each one, check
readiness against the Ledger — this is the part the tooling cannot decide for you:

| Constraint | Where to check | Blocked if |
|---|---|---|
| Design information | `03-registers/rfi.yaml` | an RFI it depends on is open |
| Approvals | `03-registers/submittals.yaml` | shop drawing or sample not approved |
| Materials | `03-registers/procurement.yaml` | not ordered, or delivery after the start date |
| Predecessors | the parsed programme | a predecessor is incomplete |
| Access / permits | `02-ledger/decisions.yaml`, diary | area not handed over, permit not issued |
| Labour and plant | `02-ledger/diary.md` | resource is committed elsewhere |
| Prior defects | `03-registers/ncr.yaml` | an open NCR sits in the same location |

## Output

Group by week, then by work package. For every activity:

```
READY    A-1310  L3 MEP first fix — zone A     starts Mon 3 Aug   float 4d
BLOCKED  A-1320  L3 MEP first fix — zone B     starts Wed 5 Aug   float 4d
         └─ Blocked by: SUB-042 (containment shop drawing) submitted 12 Jul,
            still not approved — 19 days against a 21-day contractual period.
            Escalate Friday or this goes critical.
```

Every blocked line must name the specific register entry, who owns it, and how long it
has been outstanding. "Awaiting approval" with no reference is not actionable and will
be ignored.

Close with:

1. **Count** — how many ready, how many blocked, and the trend against last week. If
   the blocked count is rising, the project is losing control of its front end
   regardless of what percent complete says.
2. **The unblocking list** — the specific actions, owners and dates that would move
   items from Blocked to Ready. Ordered by float, tightest first.

## Rules

- **Do not mark an activity Ready because you cannot find a blocker.** If a register
  is empty or stale, say the readiness is unverified. A false Ready is worse than an
  admitted unknown — someone will plan labour around it.
- **Float drives priority, not start date.** A blocked activity with 2 days float
  outranks a blocked activity starting sooner with 30 days float.
- If the programme data date is more than a week old, say so at the top. The window is
  being computed from stale logic and every date in it is suspect.
