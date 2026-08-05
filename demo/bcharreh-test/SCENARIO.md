# BCHARREH-TEST — practice scenario

> Everything here is **fictional test data**. It lives in its own project
> (`BCHARREH-TEST`) so nothing touches the real BCHARREH record. Reset at any
> time by re-running `bash demo/bcharreh-test/setup.sh`.

## The situation you are dropped into

It is **Thursday 30 July 2026**. You are five months into an eight-month
renovation of two heritage stone houses in Bcharreh (fictional client: the
Choueiri estate; consultant: Salameh Engineering). Contract completion is
**27 Nov 2026**, LDs are USD 1,500/day.

The last programme update (data date 28 Jul) is not a happy one:

- **Forecast completion has slipped to 2 Dec 2026** — 5 days later than last
  month's update, and past the contract date.
- **Repointing on House B (ST-310) is driving the critical path** at −3 days
  float — the mason crew was pulled to another site for four days in mid-July.
- **Internal lime plastering (PL-700) should have started and hasn't.**
- **Joinery restoration (JN-500/JN-510) is running late** at the workshop.
- The municipality **stopped external works** on 21 Jul pending a road-occupation
  permit that the Client's side applied for. Under Art. 9.2 you have **14 days
  from awareness** to give notice — the clock runs out **4 Aug**.
- The Client has been sitting on the **stone sample approval (DEC-001)** since
  24 Jul, the **ridge-tile order (PR-001)** has a 6-week lead time and still
  isn't placed, and an **RFI on the steel tie detail (RFI-001)** has been with
  the consultant twice as long as the contract allows.

The question the kit answers: *does the bot surface all of that without being
told, and what does it feel like to run a week through it?*

## Setup (once)

On the laptop, in Ubuntu:

```bash
cd ~/Construction-React && git pull
bash demo/bcharreh-test/setup.sh
```

Then start the bot if it isn't running (`pm bot` or your usual alias) and, in
Telegram, tell it which project you're practising on:

```
/project BCHARREH-TEST
```

## Walkthrough — a morning with the bot

Do these in order. Each step shows what the bot should come back with.

### 1. `/today` — the one screen

Forecast completion against the contract date, what the contract has running
against you, what is flagged, and who owes you what. This is the only command
you need in the morning:

```
Forecast completion 2 Dec 2026
🔴 5 days beyond the contract date — USD 7,500 at stake if not excused
```

That figure is the delay damages rate from your contract multiplied by the
overrun. It is what is at stake *if the overrun is not excused* — responsibility
for each delay event is answered by you, never derived.

### 2. `/alerts` — what's on fire

Expect every tier to fire:

- 🔴 stone-sample decision overdue (DEC-001), mock-up sign-off action overdue
  (ACT-001), ridge tiles late-to-order against a 6-week lead (PR-001)
- 🟠 RFI-001 past its 7-day contract SLA; negative float on the repointing chain
- 🟡 **notice for the permit stoppage (EV-002) due 4 Aug** — this is the one
  with real money attached; miss it and the delay claim gets harder

Alerts fire once and stay quiet until things worsen — run `/alerts` twice and
the second run should say so.

### 2b. `/contract` — what it is measuring you against

The terms as configured, every exposure with your own clause numbers cited
(Art. 9.2, Art. 11.1 …), and — importantly — a list of any terms that are *not*
set, because an unset term is not being watched and that must never look like
all-clear.

### 3. `/update` — the site update, conversationally

The bot asks about the highest-priority unknowns (max 6). Answer naturally,
as the foreman would. Try these:

| Bot asks about | Try answering |
|---|---|
| PL-700 plastering start | `started monday, about 15% done` |
| ST-310 repointing | `lost four days because the client hasn't approved the stone sample` |
| Anything you don't know | `skip` |

When you report a delay, the bot asks **who caused it** — with buttons. It
never guesses responsibility; that answer is yours. Pick `Client/Consultant`
for the stone-sample delay and watch it open a delay event **with the Art. 9.2
notice deadline already computed** (14 days from today).

Finish with `stop` (or answer everything). The summary lists exactly what was
written to the ledger, and the bot sends back an **importable file for the
scheduler** — the agent never edits the master programme itself.

### 4. `/open` — who owes you what

The chase covers your side; `/open` is the other side of the table: the
client's pending decision, the consultant's overdue RFI, your own overdue
mock-up action.

### 5. `/nudge DEC-001` — make the record work for you

Drafts a chase letter for the stone-sample approval, citing the contract and
the programme impact. It lands in `06-outputs/` as a draft — **you** send it;
the bot never emails anyone.

### 6. `? questions` — ask the record anything

Prefix with `?` (or use `/ask`):

```
? what happens to completion if the permit stoppage runs another two weeks
? which of the open items is actually costing me float
? when did we first flag the tile order
```

This runs read-only over the ledger — it can quote the record but can never
change it.

### 7. Photos and documents

Send a site photo with a caption like `House B north elevation repointing`.
It's filed under `04-site/photos/` with the date and caption — contemporaneous
evidence, attached to the record. Drop a PDF (a consultant letter, a permit)
the same way.

### 8. The weekly rhythm

```
/report      — client-ready weekly report (PDF)
/diff        — what moved between the last two updates (the 5-day slip)
/health      — DCMA 14-point check on the update
/lookahead   — what needs answers in the next 14 days
```

## The same from the command line

Everything the bot does, the CLI does too — `setup.sh` prints the list:

```bash
pm exceptions BCHARREH-TEST      # what the bot would chase this morning
pm alerts BCHARREH-TEST --all    # everything flagged, including already-fired
pm open BCHARREH-TEST
pm diff BCHARREH-TEST
pm health BCHARREH-TEST
pm nudge BCHARREH-TEST DEC-001
pm report BCHARREH-TEST --pdf
```

## What to look for (the point of the exercise)

1. **Nothing was typed in twice.** One programme file plus short natural
   answers → registers, delay events, notice deadlines, draft letters.
2. **The dangerous date surfaced by itself.** The 4 Aug notice deadline is the
   kind of thing that gets missed in a busy week; here it's flagged daily
   until dealt with.
3. **The human stays in the loop at every consequential step**: responsibility
   is answered by you, letters are drafts, the programme update is a proposal
   file for the scheduler.
4. **The record is git.** After the chase, look at the ledger repo history —
   every answer is a commit. "You were warned on this date" is itself
   evidence.

## Reset

```bash
bash demo/bcharreh-test/setup.sh
```

Rebuilds the practice project from scratch. The real BCHARREH project is
never touched.
