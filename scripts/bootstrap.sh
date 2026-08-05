#!/usr/bin/env bash
#
# One-command setup for the PMCC workspace.
#
# Collapses Steps 4 and 5 of SETUP.md: creates the workspace, installs, runs the
# tests, sets up your shell, and initialises the Ledger repository. Safe to run
# more than once - every step checks before it acts.
#
#   bash scripts/bootstrap.sh
#
# What it will NOT do, because each needs a decision or a secret from you:
# create the project, fill in the contract, load the programme, or set the
# Telegram token. It prints those at the end.

set -euo pipefail

WORKSPACE="${PMCC_HOME:-$HOME/PMCC}"
LEDGER="$WORKSPACE/ledger"
INBOX="$WORKSPACE/inbox"

# The script lives in <repo>/scripts, so the package is one level up.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENT="$REPO_ROOT/pm-agent"

bold()  { printf '\033[1m%s\033[0m\n' "$1"; }
ok()    { printf '  \033[32mok\033[0m    %s\n' "$1"; }
info()  { printf '  ...   %s\n' "$1"; }
warn()  { printf '  \033[33mwarn\033[0m  %s\n' "$1"; }
die()   { printf '\n\033[31mStopped:\033[0m %s\n' "$1" >&2; exit 1; }

bold "PMCC setup"
echo

# --- 1. Prerequisites ------------------------------------------------------

command -v node >/dev/null 2>&1 || die "node is not installed. See SETUP.md step W2 (Windows) or step 3 (macOS)."
command -v git  >/dev/null 2>&1 || die "git is not installed."

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || die "Node $NODE_MAJOR is too old; 18 or newer is required."
ok "node $(node --version), git present"

# Under WSL the Windows PATH is on the Linux PATH, so a Claude Code installed on the
# Windows side answers 'command -v' and even prints a version - but cannot run here.
# The resolved path is the only thing that tells the two apart.
CLAUDE_BIN="$(command -v claude 2>/dev/null || true)"

case "$CLAUDE_BIN" in
  '')
    warn "claude not found - everything works except /ask. Install with: npm i -g @anthropic-ai/claude-code"
    ;;
  /mnt/*)
    warn "claude resolves to the Windows install ($CLAUDE_BIN) and will not run here."
    warn "/ask needs it inside Ubuntu. Install with: npm i -g @anthropic-ai/claude-code"
    ;;
  *)
    ok "claude $(claude --version 2>/dev/null | head -1)"
    ;;
esac

# Running from /mnt/c under WSL makes git painfully slow and breaks permissions
# in ways that surface much later as confusing errors.
case "$REPO_ROOT" in
  /mnt/c/*|/mnt/d/*)
    warn "This repo is on the Windows drive ($REPO_ROOT)."
    warn "Git will be very slow and permissions misbehave. Move it to your Linux home folder."
    ;;
esac

# --- 2. Workspace ----------------------------------------------------------

echo
mkdir -p "$INBOX"
ok "inbox at $INBOX"

# --- 3. Install and test ---------------------------------------------------

echo
info "installing dependencies (this takes a moment)"
( cd "$AGENT" && npm install --silent ) || die "npm install failed."
ok "dependencies installed"

info "running the test suite"
if ( cd "$AGENT" && npm test --silent >/tmp/pmcc-test.log 2>&1 ); then
  ok "$(grep -E '^# pass' /tmp/pmcc-test.log | head -1 | tr -s ' ') tests passing"
else
  tail -20 /tmp/pmcc-test.log >&2
  die "Tests failed. Do not continue - full output in /tmp/pmcc-test.log"
fi

# --- 4. Ledger repository --------------------------------------------------

echo
mkdir -p "$LEDGER/projects"

if [ -d "$LEDGER/.git" ]; then
  ok "ledger repository already initialised"
else
  git -C "$LEDGER" init -q -b main
  ok "ledger repository created at $LEDGER"
fi

# Git refuses to commit without these, and the failure appears much later as
# "nothing is ever committed" rather than as a missing setting.
if ! git -C "$LEDGER" config user.name >/dev/null 2>&1; then
  if git config --global user.name >/dev/null 2>&1; then
    ok "using global git identity: $(git config --global user.name)"
  else
    warn "no git identity set. Run, inside $LEDGER:"
    warn "  git config user.name \"Your Name\" && git config user.email \"you@example.com\""
  fi
fi

# --- 5. Shell setup --------------------------------------------------------
#
# Pick the right rc file for the shell actually in use. Writing to .zshrc on a
# WSL Ubuntu box - which runs bash - is a silent no-op, and the alias simply
# never appears.

echo
case "${SHELL##*/}" in
  zsh)  RC="$HOME/.zshrc" ;;
  bash) RC="$HOME/.bashrc" ;;
  *)    RC="$HOME/.profile" ;;
esac

MARKER="# --- pmcc ---"

if grep -qF "$MARKER" "$RC" 2>/dev/null; then
  ok "shell already configured in $(basename "$RC")"
else
  cat >> "$RC" <<EOF

$MARKER
export LEDGER_ROOT="$LEDGER/projects"
export PM_INBOX="$INBOX"
alias pm='node "$AGENT/bin/pm.js"'
EOF
  ok "added LEDGER_ROOT, PM_INBOX and the 'pm' alias to $(basename "$RC")"
fi

# --- 6. Verify -------------------------------------------------------------

echo
LEDGER_ROOT="$LEDGER/projects" node "$AGENT/bin/pm.js" doctor || true

# --- 7. What is left -------------------------------------------------------

echo
bold "Done. What is left, in order:"
cat <<EOF

  1. Reload your shell so 'pm' works:
       source $RC

  2. Create your project and fill in the contract  (SETUP.md step 6):
       pm init MARINA-01 --name "Your Project"
       nano $LEDGER/projects/MARINA-01/CLAUDE.md
       nano $LEDGER/projects/MARINA-01/project.yaml     <- notice periods go here

  3. Load your P6 export and CHECK IT AGAINST P6      (SETUP.md step 7):
       pm ingest MARINA-01 /path/to/baseline.xer --baseline
       pm ingest MARINA-01 /path/to/current.xer
     Confirm activity count, data date, forecast finish and critical count
     match what P6 shows on screen. Stop if they do not.

  4. Branding for the client report                   (SETUP.md step 8):
       cp $AGENT/report-assets/brand.example.yaml $LEDGER/brand.yaml
       nano $LEDGER/brand.yaml

  5. Telegram token and allowlist                     (SETUP.md step 9):
       cp $AGENT/.env.example $AGENT/.env
       nano $AGENT/.env

  6. Back the Ledger up off this machine              (SETUP.md step 11):
       git -C $LEDGER remote add origin <your private repo url>
       pm sync

EOF
