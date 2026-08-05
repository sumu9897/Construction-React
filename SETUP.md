# Setting up PMCC from zero

A complete, ordered run-through. Every step has something to check before you move
on, because most of what goes wrong here fails quietly rather than loudly.

Budget about two hours. Most of that is Step 6 (filling in the contract details) and
Step 7 (checking the programme parsed correctly). Do not rush either — everything
downstream is wrong if those are wrong.

---

## What you are setting up

**The Ledger** is the important idea, and it is a simpler one than the name suggests:
**a folder of files on disk, one per project**, holding everything known about that
project.

```
MARINA-01/
  00-contract/     the contract, conditions, BOQ
  01-programme/    every P6 export ever loaded, kept forever
  02-ledger/       site diary, progress, delay events
  03-registers/    RFIs, submittals, variations, NCRs, risks, procurement
  04-evidence/     photos, letters, minutes, drawings
  05-commercial/   valuations, cashflow
  06-outputs/      the reports and letters it produces
```

Not a database. Plain text files you can open in any editor — so if every line of this
software disappeared tomorrow, you would still have a well-organised project folder.

The one part that earns the name: the folder is a **git repository**. Git stamps every
change with a date and an author and will not let that history be quietly rewritten. So
you get a contemporaneous record as a side effect of ordinary use — *"on 5 August the
site engineer reported the blocks were short"* — which is what wins an extension-of-time
claim eighteen months later, and what almost nobody actually keeps.

Three other terms used throughout:

| Term | What it means |
|---|---|
| **The workspace** | `~/PMCC/` on whichever machine you run this on — the Ledger, the code, and an inbox folder, all in one place |
| **Two repositories** | The code and the Ledger are backed up separately. The code could be public one day; the Ledger holds contract sums, rates and claims strategy, so it never can be. |
| **The bot** | The Telegram chat. It reads and writes the Ledger — it is the way in, not the thing itself. Everything it does can also be done from the command line. |

---

## Before you start

Three things to have ready:

| | |
|---|---|
| A machine to run it on | A laptop is fine to start with. An always-on machine is only needed for the morning chase and alerts to fire by themselves — see *Running without an always-on machine*. |
| A P6 export of one real project | `.xer`, both a baseline and the current update if you have them |
| Your contract | The form (FIDIC Red/Yellow, bespoke), the completion date, and the notice periods |

You will also need a GitHub account, for the code and for the Ledger's off-site backup
(Steps 1, 2 and 11).

---

## Part 1 · GitHub

### Step 0. Merge the work into `main` — ✅ DONE

All the agent code lives on a branch; `main` originally held only the marketing
website. That merge has been done for you — `main` now contains `pm-agent/` and this
file.

**Check:** <https://github.com/nadimsaleh123/PMCC> shows a `pm-agent` folder.

> Each time new work is pushed to the branch, merge it again the same way: open the
> branch, **New pull request** → **Merge**. Or from a clone:
> `git checkout main && git merge origin/claude/construction-automation-usecases-pucblv && git push`

### Step 1. Rename the repository — ✅ DONE

It was `Construction-React`, after the template it started from. It is now
**`PMCC`**. GitHub redirects the old URL, so nothing already cloned breaks, and the
commit history is intact.

### Step 2. Create the private Ledger repository

The project data lives in its **own** repository, separate from the code. The code repo
can be public one day; the Ledger holds contract sums, rates and claims strategy and
must never be.

1. `https://github.com/new`
2. Name: `pmcc-ledger`
3. **Private** — check this, and check it twice
4. Do **not** add a README, .gitignore or licence. It must start empty.
5. **Create repository**

Copy the URL it shows you. You need it in Step 11.

**Check:** the repo page shows a 🔒 Private badge next to the name.

---

## On Windows: set up WSL first

Skip this if you are on a Mac or Linux.

Everything runs inside **WSL** — a real Ubuntu inside Windows. Not because the code
needs it (it is plain Node and runs natively on Windows), but because every command,
path and cron line below then matches exactly what the Mac mini will run later. You
learn one set of commands, not two.

### You will be using two different terminals

They look identical. **The prompt is the only reliable way to tell them apart**, so
check it before pasting anything:

```
PS C:\Users\you>          <- PowerShell. ONLY the wsl commands work here.
you@DESKTOP-ABC:~$         <- Ubuntu. Everything else goes here.
```

Paste a Linux command into PowerShell and you get errors like `'&&' is not a valid
statement separator` or `nvm is not recognized`. Nothing is broken — it is the wrong
shell. Every code block below says which one it belongs in.

### W1. Is WSL already installed?

**In PowerShell:**

```powershell
wsl -l -v
```

- **`Ubuntu` is listed** → it is installed. Skip to W2.
- **"no installed distributions", or the command is unrecognised** → do W1b.

### W1b. Install it

**In PowerShell, as Administrator** (right-click Start → Terminal (Admin)):

```powershell
wsl --install
```

Reboot when it asks. On the next boot an Ubuntu window opens by itself and asks you to
invent a username and password — a Linux account, nothing to do with your Windows
login. Write the password down; `sudo` needs it.

**Check:** `wsl -l -v` now shows `Ubuntu` and `VERSION 2`.

### W2. Get into Ubuntu

**This is the step that catches people.** That first Ubuntu window is not special — if
you closed it, or you are back in PowerShell, you need to go back in deliberately.

**In PowerShell:**

```powershell
wsl
```

Or launch **Ubuntu** from the Start menu — same thing.

**Check:** your prompt changed from `PS C:\Users\you>` to `you@SOMETHING:~$`. If it
still starts with `PS`, you are in PowerShell and nothing below will work.

> Everything from here to the end of setup runs in **Ubuntu**. `exit` returns you to
> PowerShell; `wsl` takes you back.

### W3. Install Node and git

Ubuntu's packaged Node is usually too old, so use nvm.

**In Ubuntu** (prompt ends in `$`, not `>`):

```bash
sudo apt update && sudo apt install -y git curl
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
exec $SHELL
nvm install --lts
```

**Check:** `node --version` prints v20 or higher, and `git --version` prints something.

### W4. Install Claude Code

If `nvm install --lts` listed `@anthropic-ai/claude-code` under a path starting
`C:\Users\…`, that is the **Windows** copy. WSL puts the Windows PATH on the Linux
PATH, so it is visible from Ubuntu but cannot run there. Do this step anyway.

**In Ubuntu:**

```bash
npm install -g @anthropic-ai/claude-code
claude
```

The first `claude` run opens a browser to sign in. Sign in, then quit it with `/exit`.

**Check:** `which claude` — the path is the only reliable tell, because
`claude --version` prints a version for the Windows copy too.

```bash
which claude
```

- A path under `/home/…/.nvm/…` → correct, this is the Ubuntu install.
- A path under `/mnt/c/…` → still the Windows install. Run the `npm install -g` line
  above in Ubuntu and check again.

### W5. Where to keep files — this one matters

Put everything in the **Linux** home folder (`~/PMCC`), **not** under `/mnt/c/`.

Git on `/mnt/c/` is extremely slow and has permission problems that produce confusing
failures later. Your Windows files are still reachable when you need them —
`/mnt/c/Users/YourName/Downloads/` — which is how you will get your `.xer` export
across in Step 7.

To open the Linux folder in Windows Explorer at any time, **in Ubuntu**:

```bash
explorer.exe .
```

### W6. One thing Windows does differently: cron

WSL does not start `cron` automatically, so scheduled jobs will silently never run.
Fix it once, **in Ubuntu**:

```bash
sudo tee /etc/wsl.conf > /dev/null <<'EOF'
[boot]
command="service cron start"
EOF
```

Then **in PowerShell** run `wsl --shutdown`, and go back in with `wsl`.

**Check:** `service cron status` says it is running.

> On laptop-only mode this matters less — see *Running without an always-on machine*
> near the end. Set it up anyway; it costs nothing and it is one less thing to
> remember later.

---

## Part 2 · The machine

> Written for the Mac mini, but every step works identically inside WSL on your
> laptop. Steps 3 and 12 are the only two that differ, and both say so.

### Step 3. Prerequisites

**On Windows you did this in W3–W4 — skip to Step 4.**

```bash
# Node 18 or newer
node --version

# If it is missing or older:
brew install node

# Claude Code — needed for /ask. You probably already have this.
claude --version
```

**Check:** `node --version` prints v18 or higher, and `claude --version` prints a
version. If `claude` is missing, `/ask` is the only thing that will not work; the rest
runs fine.

### Step 4. Create the workspace and install

```bash
mkdir -p ~/PMCC && cd ~/PMCC
git clone https://github.com/nadimsaleh123/PMCC.git website
bash website/scripts/bootstrap.sh
```

That one script does the rest of Step 4 **and all of Step 5**: creates the inbox,
installs, runs the tests, initialises the Ledger repository, adds `LEDGER_ROOT`,
`PM_INBOX` and a `pm` alias to the right shell file, then runs `pm doctor` and prints
exactly what is left. It is safe to run again at any time.

Then:

```bash
source ~/.bashrc      # or ~/.zshrc on macOS — the script tells you which
```

**Check:** the script ends with a green tests-passing line, and `pm` on its own prints
the command list.

<details>
<summary>Doing it by hand instead</summary>

```bash
mkdir -p ~/PMCC/inbox
cd ~/PMCC/website/pm-agent
npm install
npm test

# Use the rc file for the shell you actually run. WSL Ubuntu is bash;
# macOS is zsh. Writing to the wrong one fails silently.
RC=~/.bashrc; [ "${SHELL##*/}" = zsh ] && RC=~/.zshrc

cat >> "$RC" <<'EOF'
export LEDGER_ROOT=~/PMCC/ledger/projects
export PM_INBOX=~/PMCC/inbox
alias pm='node ~/PMCC/website/pm-agent/bin/pm.js'
EOF

source "$RC"
```
</details>

> Everything below uses `pm`. If you skipped the alias, write
> `node ~/PMCC/website/pm-agent/bin/pm.js` instead.

### Step 5. The Ledger repository — done by the script

`bootstrap.sh` already ran `git init` in `~/PMCC/ledger`. If you have no global git
identity it will have said so; set one inside that folder:

```bash
cd ~/PMCC/ledger
git config user.name "Your Name"
git config user.email "you@example.com"
```

**Check:** `pm doctor` shows the Ledger line as `ok`. Warnings about Telegram and
projects are expected — those come next.

---

## Part 3 · Your first project

### Step 6. Create it, then fill in the contract

```bash
pm init MARINA-01 --name "Marina Tower"
nano ~/PMCC/ledger/projects/MARINA-01/CLAUDE.md
# macOS: open ~/PMCC/ledger/projects/MARINA-01/CLAUDE.md
# Windows: explorer.exe ~/PMCC/ledger/projects/MARINA-01   then edit in Notepad
```

**This file is the step people skip, and it is the one that matters most.** Fill in:

- **Parties** — who the Employer, Engineer and Contractor are, and **which of those you
  are on this project**
- **Contract form** — FIDIC Red 1999, Yellow 2017, or the actual bespoke form
- **Contract completion date**
- **Notice period for delay events** — e.g. 28 days under Sub-Clause 20.1
- **Response periods** for RFIs and submittals

Then mirror the numeric ones into `project.yaml` in the same folder, under `contract:`,
because that is where the code reads them from:

```yaml
contract:
  form: FIDIC Red Book 1999
  completionDate: 2026-12-18
  delayNoticeDays: 28
  rfiResponseDays: 14
  submittalResponseDays: 21
```

**Why this matters:** the notice deadlines, the SLA alerts and every clause the agent
cites all come from these numbers. Left blank, the system does not guess — it stays
silent, and you lose the single most valuable thing it does.

**Check:** `cat ~/PMCC/ledger/projects/MARINA-01/project.yaml` shows your real numbers,
not `null`.

### Step 7. Load the programme — and verify it

Both schedulers work; the file extension decides the parser:

- **Primavera P6**: File → Export → Primavera PM (XER) → `.xer`
- **Microsoft Project**: File → Save As → choose **XML Format** → `.xml`.
  Not `.mpp` — that is the binary format and it is refused with an error.

```bash
pm ingest MARINA-01 ~/Downloads/baseline.xer --baseline
pm ingest MARINA-01 ~/Downloads/current-update.xer
```

> **On Windows**, your export is on the Windows side, not in the Linux home
> folder. Use the `/mnt/c/` path — tab-completion works:
> ```bash
> pm ingest MARINA-01 /mnt/c/Users/YourName/Downloads/baseline.xml --baseline
> ```

**Now open your scheduler side by side and confirm all four of these match:**

| The output says | Check in P6 / MS Project |
|---|---|
| Activity count | Total activities in the project (MSP: excluding summary rows) |
| Data date | P6: Project → Data Date. MSP: Project → Status Date |
| Forecast finish | Your completion milestone's finish |
| Critical count | Activities with total float ≤ 0 |

> **MS Project users:** set a Status Date (Project → Status Date) before
> exporting. Without one the data date falls back to the file's last-saved
> time, which makes "overdue" mean "overdue as of whenever someone last had
> the file open" — not a basis for chasing anyone.

**If any of these disagree, stop and tell me.** Every report, alert and claim built on
top inherits the error, and it will not be obvious later.

Once they match:

```bash
pm health MARINA-01     # DCMA 14-point check on the programme
pm diff MARINA-01       # only works once two updates are ingested
```

### Step 8. Branding for the client report

```bash
cp ~/PMCC/website/pm-agent/report-assets/brand.example.yaml ~/PMCC/ledger/brand.yaml
nano ~/PMCC/ledger/brand.yaml
# or: explorer.exe ~/PMCC/ledger   (Windows)  ·  open ~/PMCC/ledger   (macOS)
```

Fill in the real contact block — address, phone, email, website — and the issuer name
and title. The defaults are placeholders on purpose; the only contact details anywhere
in this repo belong to the original website template's author and must not go on a
client document.

For the logo: `pmcc-logo.jpeg` works, but it has no transparency so it renders as a
solid square. A transparent PNG or an SVG looks materially better. Swap the file and
point `company.logo` at it — no code change needed.

```bash
pm report MARINA-01 --pdf
explorer.exe ~/PMCC/ledger/projects/MARINA-01/06-outputs/reports   # Windows
# macOS: open ~/PMCC/ledger/projects/MARINA-01/06-outputs/reports/
```

**Check:** the PDF opens, page 1 fits on one sheet, your letterhead and contact details
are right, and the command printed no warnings. Anything it lists under *"Before this
goes to a client"* is worth fixing now.

---

## Part 4 · The Telegram bot

### Step 9. Create the bot and lock it down

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. `/newbot`, give it a name and a username
3. Copy the token

```bash
cd ~/PMCC/website/pm-agent
cp .env.example .env
nano .env          # paste the token into TELEGRAM_BOT_TOKEN
```

`.env` is read automatically — you do not need to source it. A real environment
variable always wins, so the launchd plist in Step 12 stays authoritative.

Start it and find your chat id:

```bash
pm bot
```

Message your bot anything. The terminal prints:

```
[bot] ignoring message from unauthorised chat 512334
```

That number is your chat id. Stop the bot (Ctrl-C), put it in `.env`:

```
TELEGRAM_ALLOWED_CHAT_IDS=512334
```

Restart with `pm bot` and message it again — it should now answer.

> **The allowlist is the whole security model.** Empty means the bot ignores everyone,
> which is the safe default. Anyone on it can read the entire Ledger, contract included
> — so add your PM here, and nobody else until roles exist.

**Check:** `/help` in Telegram returns the command list.

### Step 10. Try each thing once

In the Telegram chat:

```
/status      → forecast completion and progress
/alerts      → whatever is currently flagged
/report      → the PDF arrives as a file
/chase       → it asks you about the first activity
/ask when does the contract say completion is?
```

Send a photo with a caption like `A-1240 level 3 blockwork` and it files as evidence.
Send a PDF with the caption `contract` and it files into `00-contract/`, hashed.

**Check:** `/chase` asks a question, you answer in plain English — *"started tuesday,
about 30%, waiting on the blocks"* — and it records it. Then look at
`~/PMCC/ledger/projects/MARINA-01/02-ledger/diary.md`; your words should be there
verbatim, with your name.

---

## Part 5 · Make it permanent

### Step 11. Back up the Ledger off the machine

Using the private repo from Step 2:

```bash
cd ~/PMCC/ledger
git remote add origin https://github.com/nadimsaleh123/pmcc-ledger.git
pm sync
```

**Check:** `pm sync` says it pushed, and the GitHub repo now shows your files —
and still shows 🔒 **Private**.

**Do not skip this step.** It is the only thing standing between you and losing the
whole record if the Mac mini's disk fails — and it is a machine running around the
clock. A private repo is also what makes Step 14, working from a laptop, possible at
all.

> The one case where this changes: a client contract that forbids storing project data
> with a third party, which some government work does. Then the answer is a private
> network such as Tailscale between your own machines, *plus* a separate encrypted
> backup — because a network between two machines is not a backup.

### Step 12. Run it around the clock

**On a laptop, skip this and read *Running without an always-on machine* below
instead.** launchd is macOS-only, and a laptop that sleeps cannot hold a schedule.


Create `~/Library/LaunchAgents/com.pmcc.bot.plist` using the template in
`pm-agent/README.md` (under *Running it unattended on a Mac mini*), then:

```bash
launchctl load ~/Library/LaunchAgents/com.pmcc.bot.plist
```

**Two fields catch everybody**: `UserName` must be your account, and `HOME` must be
your home folder. launchd does not set `HOME` reliably, and without it `claude` cannot
find its login — so `/ask` fails under launchd while working perfectly in your
terminal.

Then schedule the routine work:

```bash
crontab -e
```

```cron
# Morning chase, Sunday–Thursday
0  7 * * 0-4 cd /Users/you/PMCC/website/pm-agent && /usr/local/bin/node bin/pm.js chase MARINA-01 --send

# Alerts, half an hour earlier. Silent on a quiet day.
30 6 * * 0-4 cd /Users/you/PMCC/website/pm-agent && /usr/local/bin/node bin/pm.js alerts MARINA-01 --send

# File anything dropped in the inbox
*/15 * * * * cd /Users/you/PMCC/website/pm-agent && /usr/local/bin/node bin/pm.js inbox MARINA-01

# Keep the laptop in step
*/10 * * * * cd /Users/you/PMCC/website/pm-agent && /usr/local/bin/node bin/pm.js sync
```

Adjust `0-4` if you do not work a Sunday–Thursday week, and check `which node` — the
path may be `/opt/homebrew/bin/node` on Apple Silicon.

### Step 13. Final check

```bash
pm doctor --deep
```

**Check:** every line reads `ok`. `--deep` makes a real Claude call (a few cents) to
prove the CLI is genuinely signed in, which nothing else can establish.

If it reports a problem, each line carries its own fix.

---

## Part 6 · Working from elsewhere

### Step 14. A second machine

```bash
mkdir -p ~/PMCC
cd ~/PMCC
git clone https://github.com/nadimsaleh123/PMCC.git website
git clone https://github.com/nadimsaleh123/pmcc-ledger.git ledger
cd website/pm-agent && npm install

bash website/scripts/bootstrap.sh
source ~/.bashrc          # or ~/.zshrc — the script tells you which
pm sync
```

Run `pm sync` before and after you work. Both machines stay in step.

**Do not** put `~/PMCC/ledger` inside Google Drive, Dropbox or iCloud. They sync `.git`
internals out of order and corrupt the repository — you would lose the tamper-evident
history that makes the record worth having.

### Step 15. Documents from anywhere

Two routes, use whichever suits:

- **Telegram** — send the file with a caption (`contract`, `drawing rev C`,
  `minutes`). Filed, hashed, committed. 20 MB limit.
- **The inbox** — put it in `~/PMCC/inbox/MARINA-01/contract/` and the cron files it
  within 15 minutes. No size limit.

To make the inbox reachable from your laptop and phone, point **Google Drive at
`~/PMCC/inbox` only** — never at the ledger folder.

To read reports anywhere, mirror the outputs out:

```cron
0 * * * * rsync -a --delete ~/PMCC/ledger/projects/MARINA-01/06-outputs/ ~/"Google Drive/My Drive/PMCC/MARINA-01/"
```

Mirror `06-outputs/` and nothing above it — the project root would put `00-contract/`
and `05-commercial/` in a folder you might one day share.

---

## Running without an always-on machine

Running on a laptop that sleeps and travels? Almost everything still works. Only one
capability actually needs a machine that is always on.

### What changes

| | |
|---|---|
| **Still works exactly the same** | Loading and verifying P6, the weekly client PDF, `diff`, `health`, `lookahead`, `alerts`, `ask`, `nudge`, `open`, filing documents, and the bot itself whenever it is running |
| **Only while `pm bot` is running** | The bot replying to you in Telegram |
| **Does not happen by itself** | The 7am chase and the alert run. You start them. |

**Messages are not lost while the bot is off.** Telegram holds undelivered updates for
about 24 hours, so a photo or an answer you send overnight arrives as soon as you start
the bot next morning. Beyond a day it is dropped, so do not leave it off for a week and
expect a backlog.

### A workable daily routine

Open Ubuntu (or Terminal) in the morning and run:

```bash
pm alerts MARINA-01     # anything that needs attention
pm bot                  # leave this window open while you work
```

Then use Telegram normally — `/chase`, photos, documents, `/ask`, `/report`. Close the
window at the end of the day.

To have the chase come to you rather than typing `/chase`:

```bash
pm chase MARINA-01 --send
```

Or answer it right in the terminal, no Telegram at all:

```bash
pm chase MARINA-01
```

### Moving to the always-on machine later

Deliberately cheap, because the Ledger is a git repository:

```bash
# on the Mac mini, when you next have access
git clone https://github.com/nadimsaleh123/PMCC.git ~/PMCC/website
git clone https://github.com/nadimsaleh123/pmcc-ledger.git ~/PMCC/ledger
cd ~/PMCC/website/pm-agent && npm install
```

Then Steps 9, 12 and 13 — the bot token, launchd, cron, `pm doctor --deep`. Half an
hour. Everything you recorded in the meantime is already there, because you were
running `pm sync` all along.

**One rule while both machines exist:** run `pm sync` before you start work and after
you finish. Two machines editing the same project without syncing is the one way to
create a conflict you have to resolve by hand.

---

## When something is wrong

| What you see | What it is |
|---|---|
| Bot ignores you | `TELEGRAM_ALLOWED_CHAT_IDS` empty or wrong. Watch the log for the id. |
| Bot does not reply at all (laptop) | `pm bot` is not running. It only listens while that window is open. |
| No Menu button beside the message box | Run `pm menu` — it pushes the command list and reads back what Telegram holds. Then fully close and reopen the chat; the client caches the old list. |
| `'&&' is not a valid statement separator` | You are in PowerShell, not Ubuntu. Type `wsl` first — see W2. |
| `sudo` / `nvm` / `exec` `is not recognized` | Same cause. Check the prompt: `PS C:\…>` is PowerShell, `you@…:~$` is Ubuntu. |
| `/report` says the browser is not downloaded | `npx playwright install --with-deps chromium` in `pm-agent`, on the machine running the bot. `pm doctor` confirms it. The HTML report is sent meanwhile. |
| `claude` errors about a `C:\` path, or `/ask` fails with a node error | `which claude` points at `/mnt/c/…` — that is the Windows install, not the Ubuntu one. Reinstall inside Ubuntu — see W4. |
| Everything is slow, git especially (WSL) | Files are under `/mnt/c/`. Move the workspace to the Linux home folder — see W5. |
| Cron jobs never fire (WSL) | `service cron status`. WSL does not start it by default — see W6. |
| `/ask` works in terminal, fails under launchd | `HOME` or `UserName` missing from the plist. |
| `/ask` fails after being idle | Budget too low. A question costs ~$0.01 warm, ~$0.25 cold — keep `PM_CLAUDE_BUDGET_USD` at 0.35 or above. |
| Nothing is ever committed | The ledger folder is not a git repo. `pm doctor` says so. |
| Report has a blank footer | `brand.yaml` contact block still empty. |
| Chase asks nothing | Everything was already answered today; suppression is working. Try `pm exceptions MARINA-01`. |
| Alerts went quiet | Correct. Each condition fires once and stays silent until it worsens. `pm alerts MARINA-01 --all` lists everything open. |

Anything else: `pm doctor --deep` first. It checks the things that fail silently.

---

## What you will have

- A bot that asks you every morning what moved, in plain English, and writes it down
- A tamper-evident record of every status, with who said it and when
- Notice deadlines computed the moment a delay is mentioned
- Alerts that fire once and then stay quiet
- A client-ready PDF in one command
- Contracts and drawings reaching the Ledger from wherever you are

## What you will not have yet

Stated plainly so nothing is a surprise:

- **No BOQ, valuations or cashflow.** The report reads commercial data if you type it
  in and marks it as hand-entered; otherwise the section is absent.
- **No roles.** Everyone on the allowlist can do everything, `/ask` included. Fine for
  you and a PM, not safe for site staff.
- **No monthly or board report.** The weekly only.
- **Voice notes are filed but not transcribed** unless you configure an engine.
- **You cannot raise an RFI or a VO from chat.** Registers are edited by hand.
