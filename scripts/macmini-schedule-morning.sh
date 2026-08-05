#!/usr/bin/env bash
#
# Schedule the morning run for one project.
#
#   bash scripts/macmini-schedule-morning.sh BCHARREH
#
# Alerts at 06:30, the chase at 07:00, Monday to Saturday. Separate from the
# install script because it needs a project code, and because the working week
# differs by country - edit the weekdays below to suit.
#
# Re-run it to change the project or the times.

set -euo pipefail

CODE="${1:-}"
[ -n "$CODE" ] || { echo "Usage: bash scripts/macmini-schedule-morning.sh <PROJECT-CODE>" >&2; exit 1; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENT="$REPO_ROOT/pm-agent"
LAUNCH_DIR="$HOME/Library/LaunchAgents"
LOG_DIR="$HOME/Library/Logs/pmcc"
BOT_PLIST="$LAUNCH_DIR/com.pmcc.bot.plist"

[ -f "$BOT_PLIST" ] || { echo "Run scripts/macmini-install.sh first." >&2; exit 1; }

# Inherit the environment from the bot's plist rather than recomputing it: two
# jobs pointing at different Ledgers is the failure that takes a fortnight to
# notice.
read_env() {
  /usr/libexec/PlistBuddy -c "Print :EnvironmentVariables:$1" "$BOT_PLIST" 2>/dev/null || true
}

NODE_BIN="$(/usr/libexec/PlistBuddy -c 'Print :ProgramArguments:0' "$BOT_PLIST")"
HOME_DIR="$(read_env HOME)"
PATH_VAR="$(read_env PATH)"
LEDGER_ROOT_PATH="$(read_env LEDGER_ROOT)"
TOKEN="$(read_env TELEGRAM_BOT_TOKEN)"
CHATS="$(read_env TELEGRAM_ALLOWED_CHAT_IDS)"

mkdir -p "$LOG_DIR"

# Monday=2 … Saturday=7 in launchd's numbering (Sunday is 1). Change to taste.
WEEKDAYS="2 3 4 5 6 7"

write_job() {
  local label="$1" hour="$2" minute="$3"; shift 3
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
    for arg in "$@"; do echo "    <string>$arg</string>"; done
    echo '  </array>'
    echo '  <key>EnvironmentVariables</key>'
    echo '  <dict>'
    echo "    <key>HOME</key><string>$HOME_DIR</string>"
    echo "    <key>PATH</key><string>$PATH_VAR</string>"
    echo "    <key>LEDGER_ROOT</key><string>$LEDGER_ROOT_PATH</string>"
    echo "    <key>TELEGRAM_BOT_TOKEN</key><string>$TOKEN</string>"
    echo "    <key>TELEGRAM_ALLOWED_CHAT_IDS</key><string>$CHATS</string>"
    echo '  </dict>'
    echo "  <key>WorkingDirectory</key><string>$AGENT</string>"
    echo '  <key>StartCalendarInterval</key>'
    echo '  <array>'
    for day in $WEEKDAYS; do
      echo "    <dict><key>Weekday</key><integer>$day</integer><key>Hour</key><integer>$hour</integer><key>Minute</key><integer>$minute</integer></dict>"
    done
    echo '  </array>'
    echo "  <key>StandardOutPath</key><string>$LOG_DIR/$label.log</string>"
    echo "  <key>StandardErrorPath</key><string>$LOG_DIR/$label.err</string>"
    echo '</dict>'
    echo '</plist>'
  } > "$file"

  launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$file" 2>/dev/null || launchctl load "$file"
  printf '  \033[32mok\033[0m    %s\n' "$label"
}

echo "Scheduling the morning run for $CODE"
echo

# Alerts first, so anything they raise is already on your phone when the chase
# arrives. Both send nothing on a quiet day.
write_job com.pmcc.alerts 6 30 "$NODE_BIN" "$AGENT/bin/pm.js" alerts "$CODE" --send
write_job com.pmcc.morning 7 0 "$NODE_BIN" "$AGENT/bin/pm.js" chase "$CODE" --send

echo
echo "Alerts 06:30, chase 07:00, Mon–Sat. Logs in $LOG_DIR/."
echo "The Mac mini must be awake: System Settings > Energy > Prevent automatic sleeping."
