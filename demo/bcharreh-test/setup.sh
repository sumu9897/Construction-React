#!/usr/bin/env bash
#
# Sets up the BCHARREH-TEST practice project in your Ledger: a fictional
# renovation of two heritage houses, frozen mid-project, with a baseline and
# a current MS Project programme, populated registers and two delay events.
#
#   bash demo/bcharreh-test/setup.sh
#
# Safe to run again — it rebuilds the practice project from scratch each time.
# It never touches any other project in the Ledger.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
AGENT="$REPO_ROOT/pm-agent"
PM="node $AGENT/bin/pm.js"

: "${LEDGER_ROOT:?LEDGER_ROOT is not set — run 'source ~/.bashrc' first}"
CODE="BCHARREH-TEST"
PROJECT="$LEDGER_ROOT/$CODE"

echo "Practice project: $PROJECT"

# Fresh start every time: practice data is disposable by design.
rm -rf "$PROJECT"
$PM init "$CODE" --name "Bcharreh Heritage Houses (TEST)"

cp "$HERE/CLAUDE.md"                 "$PROJECT/CLAUDE.md"
cp "$HERE/project.yaml"              "$PROJECT/project.yaml"
cp "$HERE/registers/decisions.yaml"  "$PROJECT/02-ledger/decisions.yaml"
cp "$HERE/registers/actions.yaml"    "$PROJECT/03-registers/actions.yaml"
cp "$HERE/registers/rfi.yaml"        "$PROJECT/03-registers/rfi.yaml"
cp "$HERE/registers/procurement.yaml" "$PROJECT/03-registers/procurement.yaml"
cp "$HERE/registers/events.yaml"     "$PROJECT/02-ledger/events.yaml"

$PM ingest "$CODE" "$HERE/programme-baseline.xml" --baseline
$PM ingest "$CODE" "$HERE/programme-previous.xml"
$PM ingest "$CODE" "$HERE/programme-current.xml"

# Commit the practice state so the record behaves exactly like a real project.
LEDGER="$(dirname "$LEDGER_ROOT")"
if git -C "$LEDGER" rev-parse --git-dir >/dev/null 2>&1; then
  git -C "$LEDGER" add -A
  git -C "$LEDGER" commit -q -m "test($CODE): practice scenario state" || true
fi

echo
echo "Done. Try, in order:"
echo "  pm exceptions $CODE      # what the bot would chase this morning"
echo "  pm alerts $CODE --all    # everything currently flagged"
echo "  pm open $CODE            # who owes you what"
echo "  pm diff $CODE            # current programme vs baseline"
echo "  pm health $CODE          # DCMA check on the update"
echo "  pm report $CODE --pdf    # this week's client report"
echo
echo "Then in Telegram:  /project $CODE  and follow demo/bcharreh-test/SCENARIO.md"
