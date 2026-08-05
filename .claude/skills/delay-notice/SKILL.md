---
name: delay-notice
description: Draft a contractual delay or claim notice from a recorded delay event, with the correct clause reference and deadline. Trigger on "delay notice", "notice of claim", "EOT notice", "extension of time", "Clause 20.1", "FIDIC notice", "notify the Engineer", "claim notification", "compensation event", "early warning", or when a delay event is logged and the user asks what to do about it.
---

# Delay notice

Entitlement is lost on missed notice periods far more often than on weak merits. A
notice that is late is worth nothing no matter how good the underlying case. This
skill exists to make sure that never happens.

## First: establish the contract form

Read `<LEDGER_ROOT>/<CODE>/CLAUDE.md`. The notice period, the addressee, and the
consequence of failure are all contract-specific:

- **FIDIC Red/Yellow 1999** — Sub-Clause 20.1, 28 days from when the Contractor became
  aware or should have become aware. Time-barred if missed.
- **FIDIC 2017** — Sub-Clause 20.2.1, 28 days, with the Engineer's response mechanism
  at 20.2.2.
- **NEC** — early warning and compensation event notification, 8 weeks, different
  regime entirely.
- **Bespoke Gulf forms** — read the actual clause. Do not assume it mirrors FIDIC.

**If the contract form is not stated in `CLAUDE.md`, stop and ask.** Citing the wrong
clause in a formal notice is worse than sending a plain letter — it tells the other
side you have not read your own contract.

## Then: build the notice from the record

Pull the event from `02-ledger/events.yaml`. Everything the notice asserts must trace
to something already in the Ledger:

- the date of awareness (`date`) — this starts the clock
- what happened (`description`) — the contemporaneous words, not a later reconstruction
- which activity was affected (`activity`) and its float at the time (`floatAtTimeDays`)
- the supporting diary entry, and any photos or correspondence in `04-evidence/`

Use `git log 02-ledger/diary.md` to demonstrate the record is contemporaneous. That
history is the evidence, and it is why the notice is credible.

## Structure

1. Reference and date
2. The clause under which notice is given, quoted accurately
3. The event, factually — what happened, when, where, observed by whom
4. Date of awareness, stated explicitly, and how it is evidenced
5. The effect on the works and on the programme, with the activity IDs
6. A reservation of rights on time and cost, with detailed particulars to follow
7. What is requested of the recipient

## Rules

- **Facts only.** No adjectives, no blame, no negotiating position. A notice is a
  record, not an argument. The argument comes later with the particulars.
- **Never overstate the delay effect.** If the float analysis is not done, say the
  effect is being assessed. An overstated first notice is used against you for the
  rest of the project.
- **Do not conclude entitlement.** Give notice; entitlement is determined later.
- **Never send it.** Write the draft to `06-outputs/notices/`, tell the user the
  deadline, and stop. A wrongly-worded notice is worse than a late one, and this is
  correspondence with contractual consequences — a human sends it.
- After drafting, offer to set `noticeIssued: true` in `events.yaml` — but only once
  the user confirms it has actually gone out.

## If the deadline has already passed

Say so plainly and immediately. Do not draft a backdated notice under any
circumstances. Set out the options honestly: notify late and argue the point, or rely
on other provisions. That is a decision for the user and, usually, their lawyer.
