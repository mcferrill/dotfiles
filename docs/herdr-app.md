# Portable Herdr App setup

The repo captures the active `main-smart-nav-insights` layout, the original
`main-smart-nav` fallback, keybindings/settings, Tokyo Night themes, and these
mods: `prefix`, `sessionizer`, `smart-nav`, `annotator`, `annotator-tabs`,
`insights`, and `markdown-panel`. Shipped Herdr mods are supplied by Herdr,
not copied here. Use a current Herdr App compatible with these mod APIs.

## New machine (macOS or Linux)

1. Install Herdr App and herdr-core (`hc`), Git, Node.js **22.15+**, and
   **FiraCode Nerd Font**. Put Herdr's CLIs and `~/.local/bin` on PATH.
   The general dotfiles installer does not install Herdr or the Annotator helper.
2. For Annotator, install Rust/Cargo and Python 3, then build the matching
   helper **before** `./install link` installs the vendored mod symlinks:

   ```sh
   mkdir -p ~/.local/share/herdr-mods
   git clone https://github.com/jakub-tucek/herdr-annotator.git \
     ~/.local/share/herdr-mods/herdr-annotator
   cd ~/.local/share/herdr-mods/herdr-annotator
   git checkout 34db7684bffca2ec74271e97ac8dc66130d9a846
   python3 scripts/install.py
   ```

   This installs `~/.local/bin/herdr-annotator`, its updater, and local tool
   paths/installation receipt. Run it without `--layout`: our layout is already
   integrated. GitHub review threads additionally need `gh` and `gh auth login`.
   Pi/OpenCode ordering needs that agent installed and authenticated locally.
   No extra Annotator install is needed on remote machines.
3. From this dotfiles checkout, run:

   ```sh
   ./install link
   node test-herdr-config.mjs
   ```

   Linking backs up existing unmanaged files, installs individual symlinks,
   generates the machine's Insights Node path, and selects
   `main-smart-nav-insights`. It does not start or restart Herdr.
   If Herdr is closed, the selected layout takes effect at its next launch.
   If already running, setup asks its CLI to switch layouts without rewriting
   its shared state. Close or save work normally; do not kill Herdr to install.
4. In the running app, check `herdr-app status` for load errors. For a smoke
   check of the installed mods:

   ```sh
   for mod in prefix sessionizer smart-nav annotator annotator-tabs insights markdown-panel; do
     herdr-app check "$HOME/.config/herdr-app/mods/$mod" || break
   done
   ```

   The repo's installer targets `~/.config/herdr-app` (or the test `DOT_HOME`),
   not an arbitrary `HERDR_APP_HOME`. These instructions assume the default home.

## Per-machine integrations

Insights scans supported agents' local histories using home-relative defaults;
its index rebuilds on each machine. No history, prompts, cached quotas, or
credentials are distributed. The current dashboard preferences match its
built-in defaults, so no preferences export is needed.

Quota integrations must be enabled on each machine using Insights' controls,
or explicitly with the following commands, choosing only providers you use:

```sh
app_home="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
node "$app_home/mods/insights/quotas.mjs" enable-codex --store "$app_home/data/insights"
node "$app_home/mods/insights/quotas.mjs" enable-claude --store "$app_home/data/insights"
node "$app_home/mods/insights/quotas.mjs" enable-grok --store "$app_home/data/insights"
```

Codex must be installed/authenticated. Claude activation modifies that machine's
Claude settings to capture status-line quotas while preserving the previous
status-line command; don't copy those settings or hooks from another machine.
Use the corresponding `disable-*` command to undo an integration.

The Markdown panel can be opened with:

```sh
herdr-app do mod.open '{"name":"markdown-panel"}'
```

Its optional macOS file association is **not** installed automatically. To make
Markdown files open in Herdr on a Mac with Xcode Command Line Tools:

```sh
sh ~/.config/herdr-app/mods/markdown-panel/markdown-handler.sh install
# Undo with the same command and "uninstall" instead.
```

## Local-only state and updates

Keep `shared.json`, `data/`, window/view state, generated API typings, install
receipts, credentials, and caches local. Spaces, tabs, pane splits, and running
terminals belong to herdr-core, not a portable layout. Per-space colors,
workspace panel selections, and review drafts aren't copied between machines.

`mods/insights/runtime.json` is generated locally from `process.execPath` each
time setup runs, with a backup when changed. After upgrading/removing your Node
installation, run `./install link` using the replacement Node. Don't commit an
absolute runtime path or copy quota hooks from another host.

The mods are vendored snapshots. Don't run third-party mod installers or the
Annotator in-app updater over dotfiles-managed files: they can replace symlinks
or change this checkout. For an upgrade, stage/test the upstream release outside
this checkout, deliberately refresh the vendored sources and matching Annotator
helper revision, then relink. Keep upstream licenses with copied code.

### Source provenance

- Annotator and Annotator Tabs: [jakub-tucek/herdr-annotator](https://github.com/jakub-tucek/herdr-annotator),
  version 0.2.0, commit `34db7684bffca2ec74271e97ac8dc66130d9a846` (MIT).
- Insights: [GaganSD/coding-agent-toolkit](https://github.com/GaganSD/coding-agent-toolkit/tree/main/herdr-insights),
  installed snapshot reporting version 0.1.0 (MIT). Its installed distribution
  did not record a commit; the vendored files are the snapshot, not a floating
  download during setup.
- Markdown Panel: [jlopezlira/herdr-kanso](https://github.com/jlopezlira/herdr-kanso),
  installed snapshot from checkout `f5ebd11f38bbe6135ca8abef48b3b32ee3c365d2`
  (Apache-2.0).

Upstream API typings and editor configs are generated by Herdr and omitted.
