#!/usr/bin/env bash
#
# Pull new code, prove it works, then restart the bot.
#
# Run hourly by com.pmcc.update. The order matters: a bot that auto-updates
# without testing will one day pull a bad commit at 3am and go silent, and the
# first you know of it is a site update that never got asked for. So the tests
# are the gate - if they fail, the machine keeps running the last good version
# and says so in the log.
#
#   bash scripts/self-update.sh
#
# Safe to run by hand. Does nothing at all when there is nothing new.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENT="$REPO_ROOT/pm-agent"
BRANCH="${PMCC_BRANCH:-main}"

log() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1"; }

cd "$REPO_ROOT"

# Never clobber local work. If this machine has uncommitted changes, someone was
# editing here and an automated reset would destroy that.
if [ -n "$(git status --porcelain)" ]; then
  log "local changes present - skipping update. Commit or stash them on the mini."
  exit 0
fi

BEFORE="$(git rev-parse HEAD)"

if ! git fetch --quiet origin "$BRANCH"; then
  log "fetch failed (network?) - keeping the current version"
  exit 0
fi

AFTER="$(git rev-parse "origin/$BRANCH")"

if [ "$BEFORE" = "$AFTER" ]; then
  exit 0
fi

log "new commits: $(git rev-parse --short "$BEFORE") -> $(git rev-parse --short "$AFTER")"
git log --oneline "$BEFORE..$AFTER" | sed 's/^/    /'

# Fast-forward only. A divergence means someone committed on the mini and pushed
# elsewhere, and silently rewriting that is worse than stopping.
if ! git merge --ff-only "origin/$BRANCH" --quiet; then
  log "cannot fast-forward - the mini has diverged from origin/$BRANCH. Resolve it by hand."
  exit 1
fi

# Only reinstall when the dependency set actually moved; npm install on every
# pull turns a one-second update into a minute of churn.
#
# The missing-directory case is not hypothetical: on a fresh checkout the
# dependencies have never been installed, package.json has not "changed", and
# every test fails for want of node_modules - which would roll back a perfectly
# good commit, every hour, forever.
if [ ! -d "$AGENT/node_modules" ]; then
  log "no node_modules - installing"
  ( cd "$AGENT" && npm install --silent )
elif ! git diff --quiet "$BEFORE" "$AFTER" -- pm-agent/package.json pm-agent/package-lock.json; then
  log "dependencies changed - installing"
  ( cd "$AGENT" && npm install --silent )
fi

log "running tests"
if ! ( cd "$AGENT" && npm test >/tmp/pmcc-selfupdate-test.log 2>&1 ); then
  log "TESTS FAILED on $(git rev-parse --short "$AFTER") - rolling back to $(git rev-parse --short "$BEFORE")"
  tail -20 /tmp/pmcc-selfupdate-test.log | sed 's/^/    /'
  git reset --hard "$BEFORE" --quiet
  log "still running the last good version; the bot was not restarted"
  exit 1
fi

log "tests pass - restarting the bot"
launchctl kickstart -k "gui/$(id -u)/com.pmcc.bot" 2>/dev/null || log "could not restart com.pmcc.bot - is it loaded?"

# The command menu is a property of the bot on Telegram's side, not of this
# process, so a new or renamed command needs pushing separately.
( cd "$AGENT" && node bin/pm.js menu >/dev/null 2>&1 ) && log "command menu refreshed" || log "menu refresh skipped"

log "now on $(git rev-parse --short HEAD)"
