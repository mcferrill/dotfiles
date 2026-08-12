#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_HOME="$(mktemp -d)"
trap 'rm -rf "$TEST_HOME"' EXIT

run_dot() { DOT_HOME="$TEST_HOME" "$ROOT/install" "$@"; }
for command in init update link unlink packages doctor help; do
  run_dot "$command" --help >/dev/null
done
run_dot packages update --help >/dev/null
assert_link() {
  [[ -L "$TEST_HOME/$1" ]] || { echo "expected link: $1" >&2; exit 1; }
  [[ "$(readlink "$TEST_HOME/$1")" == "$ROOT/$2" ]] || { echo "wrong target: $1" >&2; exit 1; }
}

run_dot link
assert_link .zshrc config/zshrc
assert_link .config/nvim/init.lua config/nvim.lua
run_dot link

rm "$TEST_HOME/.zshrc"
ln -s "$ROOT/config/bashrc" "$TEST_HOME/.zshrc"
run_dot link
assert_link .zshrc config/zshrc

rm "$TEST_HOME/.zshrc"
printf 'unmanaged\n' > "$TEST_HOME/.zshrc"
if run_dot link >/dev/null 2>&1; then
  echo "refused overwrite test failed" >&2
  exit 1
fi
rm "$TEST_HOME/.zshrc"

run_dot unlink
[[ ! -e "$TEST_HOME/.zshrc" ]] || { echo "unlink failed" >&2; exit 1; }

run_dot --dry-run link >/dev/null
echo "dot tests passed"
