# PMCC

Two unrelated things live here. They share a repository and nothing else — the
website imports nothing from the agent, and the agent imports nothing from the
website.

| | |
|---|---|
| **The website** — `src/`, `index.html`, `vite.config.js` | The public site. React 18 + Vite + Tailwind. Deployed to Render on every push to `main`. |
| **The agent** — `pm-agent/` | The Project Ledger, the programme parser and the Telegram PM bot. Runs on the Mac mini. See [`pm-agent/README.md`](pm-agent/README.md) and [`SETUP.md`](SETUP.md). |

---

## Working on the website

### Once, on a new machine

```bash
npm install
```

### The loop

```bash
npm run dev
```

Open <http://localhost:5173>. Edit a file, save, and the browser updates without
reloading. **Nothing you do here touches the live site** — this is a server
running on your own machine, serving the files on your own disk. The deployed
site changes only when something reaches `main` on GitHub.

Leave it running while you work. This is where almost all of your time should go.

### Before you push

```bash
npm run check
```

Runs the linter, then a real production build. Two minutes here saves a broken
deploy, because **the dev server is more forgiving than the build**. It tolerates
things that fail in production — an import with the wrong capitalisation works on
macOS and Windows and breaks on Render's Linux. If `npm run check` passes, the
deploy will almost certainly succeed.

To look at the *production* build rather than the dev version:

```bash
npm run build && npm run preview
```

That serves the real, minified output — the same files Render serves. Worth doing
whenever you have changed fonts, images or animation timing, because those are
what differ most between dev and production.

---

## The safe way to change things

The habit that matters: **`main` is live, so do not work on `main`.**

That is more true here than on most projects, because `main` drives two machines.
Render rebuilds the public site from it, and the Mac mini pulls it every hour and
restarts the bot. A half-finished commit on `main` reaches a client-facing
website and a production bot without anyone deciding that it should.

```bash
# 1. Start from the current main
git switch main
git pull

# 2. Branch, named for what you are doing
git switch -c fix/logo-spacing

# 3. Work. Commit as you go - small commits are easier to undo than big ones.
npm run dev
git add -A
git commit -m "Centre the client logos between the rules"

# 4. Prove it
npm run check

# 5. Push the branch, not main
git push -u origin fix/logo-spacing
```

Then open a pull request on GitHub. A pull request is just *"please put my branch
into main"* — it gives you a diff of everything that would change, somewhere to
look it over, and a record of why. Merge it when you are happy, and Render
deploys within a couple of minutes.

If the branch turns out to be a bad idea, delete it. Nothing was ever at risk.

### Branch names

Convention, not law — but a repository where every branch is called `test2` is
one nobody can navigate.

```
fix/logo-spacing          something is wrong
feat/contact-form         something new
copy/homepage-headline    words only
```

---

## When it goes wrong

**The deploy failed.** Render shows the build log. It is almost always the same
error `npm run check` would have shown you locally.

**It deployed and it looks wrong.** Do not scramble to fix forward. In Render:
the service → **Deploys** → the last good one → **Rollback**. The site is back in
under a minute, and *then* you fix the cause properly on a branch.

**You committed to `main` by mistake and have not pushed yet:**

```bash
git switch -c fix/whatever    # take the commits onto a branch
git switch main
git reset --hard origin/main  # put main back to what GitHub has
```

---

## What happens when something reaches `main`

| | |
|---|---|
| Render | Rebuilds and deploys the public site, usually within two minutes |
| Mac mini | Pulls within the hour, **runs the agent's test suite**, and restarts the bot only if it passes — see `scripts/self-update.sh` |

The mini refuses to move onto a commit whose tests fail, and keeps serving the
last good version instead. The website has no such gate, which is exactly why
`npm run check` is worth the two minutes.

---

## The agent

Different rules, because it writes a contemporaneous record that ends up in
payment applications and claims:

```bash
cd pm-agent
npm install
npm test          # every test should pass before anything is pushed
```

Read [`CLAUDE.md`](CLAUDE.md) before changing anything under `pm-agent/`. The
constraints there — never infer entitlement, never fabricate a measurement,
never send anything externally — are why the thing can be trusted, and they are
not stylistic.
