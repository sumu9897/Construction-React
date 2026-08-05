#!/usr/bin/env bash
#
# Turn a Mac mini into the always-on home for the PM agent.
#
#   bash scripts/macmini-install.sh
#
# Installs four launchd agents:
#   com.pmcc.bot          the Telegram bot, restarted automatically if it dies
#   com.pmcc.update       pulls new code, runs the tests, restarts the bot if green
#   com.pmcc.sync         pulls and pushes the Ledger repository
#   com.pmcc.morning      the daily chase and alerts
#
# Safe to run again. Every step checks before it acts, and re-running is how you
# apply a change to the schedule or the environment.
#
# It will not invent secrets. TELEGRAM_BOT_TOKEN and TELEGRAM_ALLOWED_CHAT_IDS
# must already be in pm-agent/.env, because those are the whole security model
# and a script that guessed at them would be worse than one that stops.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENT="$REPO_ROOT/pm-agent"
WORKSPACE="${PMCC_HOME:-$HOME/PMCC}"
LEDGER="$WORKSPACE/ledger"
LAUNCH_DIR="$HOME/Library/LaunchAgents"
LOG_DIR="$HOME/Library/Logs/pmcc"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
ok()   { printf '  \033[32mok\033[0m    %s\n' "$1"; }
info() { printf '  ...   %s\n' "$1"; }
warn() { printf '  \033[33mwarn\033[0m  %s\n' "$1"; }
die()  { printf '\n\033[31mStopped:\033[0m %s\n' "$1" >&2; exit 1; }

bold "PMCC — always-on install"
echo

# --- 1. This has to be a Mac ----------------------------------------------

[ "$(uname -s)" = "Darwin" ] || die "This installs launchd agents, which are macOS only. Run it on the Mac mini."
ok "macOS $(sw_vers -productVersion)"

# --- 2. Absolute paths, because launchd has almost no PATH ----------------

# launchd starts with a minimal environment: a bare `node` will not resolve, and
# the failure is a silent non-start rather than an error you would notice.
NODE_BIN="$(command -v node || true)"
[ -n "$NODE_BIN" ] || die "node is not on your PATH. Install it first (brew install node, or nvm)."

case "$NODE_BIN" in
  "$HOME"/.nvm/*)
    # nvm's path contains the version, so an nvm upgrade silently breaks the
    # plist months later. Point at the stable alias if there is one.
    if [ -x "$HOME/.nvm/alias/default" ] || [ -d "$HOME/.nvm/versions/node" ]; then
      warn "node is managed by nvm ($NODE_BIN)."
      warn "An nvm upgrade will change that path and the bot will stop starting."
      warn "Consider 'brew install node' on this machine so the path is stable."
    fi
    ;;
esac
ok "node $("$NODE_BIN" --version) at $NODE_BIN"

GIT_BIN="$(command -v git)" || die "git is not installed."
LAUNCH_PATH="$(dirname "$NODE_BIN"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

# --- 3. Secrets must already exist ----------------------------------------

ENV_FILE="$AGENT/.env"
[ -f "$ENV_FILE" ] || die "No $ENV_FILE. Create it with TELEGRAM_BOT_TOKEN and TELEGRAM_ALLOWED_CHAT_IDS before running this."

# shellcheck disable=SC1090
TOKEN="$(grep -E '^TELEGRAM_BOT_TOKEN=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
CHATS="$(grep -E '^TELEGRAM_ALLOWED_CHAT_IDS=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"

[ -n "$TOKEN" ] || die "TELEGRAM_BOT_TOKEN is empty in $ENV_FILE."
[ -n "$CHATS" ] || die "TELEGRAM_ALLOWED_CHAT_IDS is empty in $ENV_FILE. An empty allowlist means the bot ignores everyone."
ok "token and allowlist present"

# --- 4. Ledger -------------------------------------------------------------

LEDGER_ROOT_PATH="$LEDGER/projects"
[ -d "$LEDGER_ROOT_PATH" ] || die "No Ledger at $LEDGER_ROOT_PATH. Clone pmcc-ledger to $LEDGER first, then re-run."
"$GIT_BIN" -C "$LEDGER" rev-parse --git-dir >/dev/null 2>&1 || die "$LEDGER is not a git repository, so nothing can be synced off this machine."
ok "ledger at $LEDGER_ROOT_PATH"

# --- 5. Dependencies and the browser --------------------------------------

echo
info "installing dependencies"
( cd "$AGENT" && npm install --silent ) || die "npm install failed."

if ! ( cd "$AGENT" && npx playwright install chromium >/dev/null 2>&1 ); then
  warn "could not install the Chromium build - reports will be HTML until 'npx playwright install chromium' succeeds"
else
  ok "chromium present - reports render as PDF"
fi

mkdir -p "$LOG_DIR" "$LAUNCH_DIR"

# --- 6. The agents ---------------------------------------------------------

# One writer for all four plists. Keeping the environment identical across them
# is the point: a job that runs with a different LEDGER_ROOT than the bot writes
# to a different Ledger, and you would not notice for weeks.
write_plist() {
  local label="$1" schedule="$2"; shift 2
  local file="$LAUNCH_DIR/$label.plist"

  {
    echo '<?xml version="1.0" encoding="UTF-8"?>'
    echo '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">'
    echo '<plist version="1.0">'
    echo '<dict>'
    echo "  <key>Label</key><string>$label</string>"
    echo "  <key>UserName</key><string>$(id -un)</string>"
    echo '  <key>ProgramArguments</key>'
    echo '  <array>'
    for arg in "$@"; do
      echo "    <string>$arg</string>"
    done
    echo '  </array>'
    echo '  <key>EnvironmentVariables</key>'
    echo '  <dict>'
    # HOME is the one that catches everybody: launchd does not set it reliably,
    # and without it `claude` cannot find its login in ~/.claude, so /ask fails
    # under launchd while working perfectly from a terminal.
    echo "    <key>HOME</key><string>$HOME</string>"
    echo "    <key>PATH</key><string>$LAUNCH_PATH</string>"
    echo "    <key>LEDGER_ROOT</key><string>$LEDGER_ROOT_PATH</string>"
    echo "    <key>PM_INBOX</key><string>$WORKSPACE/inbox</string>"
    echo "    <key>TELEGRAM_BOT_TOKEN</key><string>$TOKEN</string>"
    echo "    <key>TELEGRAM_ALLOWED_CHAT_IDS</key><string>$CHATS</string>"
    echo '  </dict>'
    echo "  <key>WorkingDirectory</key><string>$AGENT</string>"
    echo "$schedule"
    echo "  <key>StandardOutPath</key><string>$LOG_DIR/$label.log</string>"
    echo "  <key>StandardErrorPath</key><string>$LOG_DIR/$label.err</string>"
    echo '</dict>'
    echo '</plist>'
  } > "$file"

  # bootout then bootstrap: `load` on an already-loaded label is an error, and
  # re-running this script has to be the normal way to apply a change.
  launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$file" 2>/dev/null || launchctl load "$file"
  ok "$label"
}

echo

# The bot. KeepAlive restarts it if it crashes or if the machine reboots.
write_plist com.pmcc.bot \
  '  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>' \
  "$NODE_BIN" "$AGENT/bin/pm.js" bot

# Code updates, hourly. Pulls, tests, and only then restarts the bot.
write_plist com.pmcc.update \
  '  <key>StartInterval</key><integer>3600</integer>
  <key>RunAtLoad</key><false/>' \
  /bin/bash "$REPO_ROOT/scripts/self-update.sh"

# Ledger sync, every 15 minutes, so the record is never only on this machine.
write_plist com.pmcc.sync \
  '  <key>StartInterval</key><integer>900</integer>
  <key>RunAtLoad</key><false/>' \
  "$NODE_BIN" "$AGENT/bin/pm.js" sync

echo
bold "Installed"
echo
echo "  Logs      $LOG_DIR/"
echo "  Status    launchctl list | grep pmcc"
echo "  Restart   launchctl kickstart -k gui/\$(id -u)/com.pmcc.bot"
echo "  Stop      launchctl bootout gui/\$(id -u)/com.pmcc.bot"
echo
info "verifying"
( cd "$AGENT" && "$NODE_BIN" bin/pm.js doctor ) || warn "pm doctor reported problems - see above"

echo
echo "The morning chase is not scheduled yet: it needs a project code."
echo "Once you have one, run:"
echo
echo "  bash scripts/macmini-schedule-morning.sh BCHARREH"
echo
echo "In Telegram, send /today. If it answers, this machine is now the bot."
