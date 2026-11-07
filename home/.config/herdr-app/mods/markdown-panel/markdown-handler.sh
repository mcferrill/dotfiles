#!/bin/sh
# Kanso Markdown (macOS): makes .md files open in Herdr, formatted and
# editable (Kanso's side panel, or the markdown-panel mod's window in any
# other layout), instead of in the app macOS uses for them. That covers a
# Cmd-click on a path in a terminal (Herdr hands it to macOS) and a double
# click in Finder. Nothing else changes, and only when you run it.
#
#   sh markdown-handler.sh install     make Kanso Markdown the app for .md files
#   sh markdown-handler.sh uninstall   give .md files back to the app they had
#
# Kanso Markdown is a small AppleScript app in ~/Applications. It writes the
# file's path into Herdr's data/kanso-open folder, where Kanso (kanso-tabs)
# or the markdown-panel mod picks it up; outside Kanso it opens that mod's
# window if it isn't open. Then it brings Herdr to the front. When Herdr
# isn't running, it opens the file in TextEdit.
set -eu

[ "$(uname)" = Darwin ] || { echo "Kanso Markdown is for macOS." >&2; exit 1; }

APP="$HOME/Applications/Kanso Markdown.app"
ID="dev.kanso.markdown"
HOME_DIR="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
INBOX="$HOME_DIR/data/kanso-open"
SAVED="$HOME_DIR/data/kanso-markdown-previous"
TYPES="net.daringfireball.markdown"
LSREGISTER=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister

# Prints the bundle id that opens .md files now, or sets it ($1).
handler() {
  if [ $# -eq 0 ]; then
    swift - <<'SWIFT' 2>/dev/null
import Foundation
import CoreServices
if let id = LSCopyDefaultRoleHandlerForContentType("net.daringfireball.markdown" as CFString, .all)?.takeRetainedValue() { print(id) }
SWIFT
  else
    swift - "$1" <<'SWIFT'
import Foundation
import CoreServices
let id = CommandLine.arguments[1] as NSString as CFString
let status = LSSetDefaultRoleHandlerForContentType("net.daringfireball.markdown" as CFString, .all, id)
if status != 0 { print("LaunchServices refused (\(status))"); exit(1) }
SWIFT
  fi
}

install() {
  command -v swift >/dev/null || { echo "Needs swift (Xcode or its Command Line Tools)." >&2; exit 1; }
  herdr=$(command -v herdr-app || echo "$HOME/.local/bin/herdr-app")
  script=$(mktemp "${TMPDIR:-/tmp}/kanso-markdown.XXXXXX")
  cat > "$script" <<'APPLESCRIPT'
on open theItems
	set opener to POSIX path of (path to me) & "Contents/Resources/open.sh"
	repeat with f in theItems
		do shell script "/bin/sh " & quoted form of opener & " " & quoted form of (POSIX path of f)
	end repeat
end open
on run
	display dialog "Kanso Markdown opens .md files in Herdr. Open a Markdown file to use it." buttons {"OK"} default button 1
end run
APPLESCRIPT
  mkdir -p "$HOME/Applications"
  rm -rf "$APP"
  osacompile -o "$APP" "$script"
  rm -f "$script"
  # What the app runs for each file, with this machine's paths written in.
  cat > "$APP/Contents/Resources/open.sh" <<OPEN
#!/bin/sh
p=\$1
export HERDR_APP_HOME="$HOME_DIR"
/usr/bin/pgrep -xq Herdr || exec /usr/bin/open -a TextEdit "\$p"
/bin/mkdir -p "$INBOX"
/usr/bin/printf '%s' "\$p" > "$INBOX/\$(/bin/date +%s)-\$\$.path"
s=\$("$herdr" status 2>/dev/null)
case "\$s" in
  *'"layout": "kanso"'*) ;;
  *) if [ -d "$HOME_DIR/mods/markdown-panel" ]; then
       case "\$s" in *'"markdown-panel"'*) ;; *) "$herdr" do mod.open '{"name":"markdown-panel"}' >/dev/null 2>&1 ;; esac
     fi ;;
esac
/usr/bin/open -a Herdr
OPEN
  plist="$APP/Contents/Info.plist"
  plutil -replace CFBundleIdentifier -string "$ID" "$plist"
  plutil -replace CFBundleName -string "Kanso Markdown" "$plist"
  plutil -replace LSUIElement -bool true "$plist"
  plutil -replace CFBundleDocumentTypes -json "[{\"CFBundleTypeName\":\"Markdown\",\"CFBundleTypeRole\":\"Editor\",\"LSHandlerRank\":\"Alternate\",\"LSItemContentTypes\":[\"$TYPES\"]}]" "$plist"
  codesign --force --sign - "$APP" >/dev/null 2>&1 || true
  "$LSREGISTER" -f "$APP"
  mkdir -p "$INBOX"
  previous=$(handler || true)
  if [ -n "$previous" ] && [ "$previous" != "$ID" ]; then printf '%s\n' "$previous" > "$SAVED"; fi
  handler "$ID"
  if [ "$previous" = "$ID" ]; then echo "Kanso Markdown is updated; .md files still open in Herdr."
  else echo "Markdown files now open in Herdr (they opened in ${previous:-the system default})."; fi
}

uninstall() {
  previous=$(cat "$SAVED" 2>/dev/null || echo com.apple.TextEdit)
  if [ "$(handler || true)" = "$ID" ]; then handler "$previous"; fi
  "$LSREGISTER" -u "$APP" 2>/dev/null || true
  rm -rf "$APP" "$SAVED"
  echo "Markdown files open in $previous again."
}

case "${1:-}" in
  install) install ;;
  uninstall) uninstall ;;
  *) echo "Usage: sh $0 install | uninstall" >&2; exit 2 ;;
esac
