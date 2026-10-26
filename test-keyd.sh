#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SANDBOX="$(mktemp -d)"
trap 'rm -rf "$SANDBOX"' EXIT
set -- help
source "$ROOT/install" >/dev/null
# Exercise the real setup function against a temporary path, never /etc.
definition="$(declare -f setup_keyd)"
eval "${definition//\/etc\/keyd/$SANDBOX/keyd}"
PLATFORM=arch
DOT_HOME="$HOME"
command() { [[ "$*" == '-v keyd' ]] || builtin command "$@"; }
run() {
    printf '%s\n' "$*" >>"$SANDBOX/calls"
    case "$*" in
    'keyd check') "$check_ok" ;;
    'sudo systemctl '* | 'sudo keyd reload') : ;;
    *) "$@" ;;
    esac
}
sudo() { "$@"; }
check_ok=true
setup_keyd
[[ "$(readlink "$SANDBOX/keyd")" == "$ROOT/home/.config/keyd" ]]
grep -q 'sudo keyd reload' "$SANDBOX/calls"
# Already managed: no link recreation.
: >"$SANDBOX/calls"
setup_keyd
! grep -q 'ln -s' "$SANDBOX/calls"
# Empty directories are replaced; nonempty configs are preserved.
rm "$SANDBOX/keyd"
mkdir "$SANDBOX/keyd"
setup_keyd
[[ -L "$SANDBOX/keyd" ]]
rm "$SANDBOX/keyd"
mkdir "$SANDBOX/keyd"
touch "$SANDBOX/keyd/custom.conf"
: >"$SANDBOX/calls"
setup_keyd 2>/dev/null
[[ -f "$SANDBOX/keyd/custom.conf" ]]
! grep -q 'keyd reload' "$SANDBOX/calls"
# Validation failures must prevent service activation/reload.
rm -r "$SANDBOX/keyd"
ln -s "$ROOT/home/.config/keyd" "$SANDBOX/keyd"
check_ok=false
: >"$SANDBOX/calls"
(setup_keyd) && {
    echo 'Expected validation failure' >&2
    exit 1
}
! grep -q 'systemctl\|keyd reload' "$SANDBOX/calls"
# macOS and test-home installs must not touch system state.
: >"$SANDBOX/calls"
PLATFORM=darwin
setup_keyd
PLATFORM=arch
DOT_HOME="$SANDBOX/home"
setup_keyd
[[ ! -s "$SANDBOX/calls" ]]
echo 'keyd setup tests passed'
