# mcferrill's dotfiles

This is a set of config files mostly starting with "." (hence the repo name)
that allow consistent behavior between multiple tools across environments.

## Installing and Updating

Clone the repo (eg. to $HOME/.files or $HOME/dotfiles) and install with:

`./install`

With no command, `./install` performs an idempotent, non-destructive installation.

Use `./install update` to update dotfiles, submodules, packages, and plugins.

Use `./install link`, `./install unlink`, `./install packages`, or `./install doctor` for individual operations. Use `./install help` for command help. Add `--dry-run` to inspect changes without applying them.

Managed home files live under `home/` and mirror paths below `$HOME`. Platform-specific files live under `home-darwin/`, `home-ubuntu/`, or `home-arch/`. The linker walks these trees recursively and refuses to replace unmanaged files.

Packages are declared in `packages.conf` using one entry per line: `scope type package`. Use `all` for shared packages and `darwin`, `ubuntu`, or `arch` for platform-specific entries. Use `auto` for a shared package whose native package type is obvious. Run `./install packages list` to inspect the selected package set.

## Secrets

Some things like SSH keys or private configs shouldn't be used. You can use a secrets manager like bitwarden to store and sync these items.

## Tools Configured

- zsh - completion, history search, syntax highlighting, and autosuggestions
- [starship](https://starship.rs/) - terminal styling
- [Git](https://git-scm.com/) - source code management
- Tmux - terminal multiplexer (splits/tabs, etc)
- tmate - remote terminal sharing with shared tmux configuration
- [herdr](https://herdr.dev/) - a tmux-like multiplexer made for agents
- [Neovim](https://neovim.io/) - Telescope, LSP, completion, formatting, and Treesitter (based on [kickstart.nvim](https://github.com/nvim-lua/kickstart.nvim))
- [mise](https://mise.jdx.dev/) - manages tool versions including Python, Node, Neovim, Starship, uv, PDM, and OpenCode
- [OpenCode](https://opencode.ai/) - TUI, package, and custom plugin configuration
- [pi](https://pi.dev/) - Config, extensions, MCP
- uv and PDM - Python environments and tooling
- lazygit, jq, ripgrep, fzf, git-lfs, and the Silver Searcher - command-line development tools
- [wezterm](https://wezfurlong.org/wezterm/) - cross platform terminal emulator
- macos
  - [karabiner](https://karabiner-elements.pqrs.org/) - keyboard customization (more easily generated with [this](https://github.com/mxstbr/karabiner))
  - [aerospace](https://github.com/nikitabobko/AeroSpace) - window manager (like i3)

## Pi

Local extensions live in `home/.pi/agent/extensions/`:

- `git-interceptor.ts` prevents interactive Git editor hangs and blocks `--no-verify`
  in Git-related bash calls. This is a convenience guard, not a shell sandbox.
- `/save-md path` saves the latest assistant response on the active branch as
  Markdown, excluding thinking/tool calls and refusing to overwrite existing files.

New shared skills belong in `home/.agents/skills/` (installed to
`~/.agents/skills/`, which Pi discovers automatically). Existing externally managed
collections stay in place; their explicit includes/exclusions use portable `~/`
paths. Missing collections must be installed separately on each machine.

Run `node test-pi.mjs` with Node 24+ to check the extensions and configuration.
After linking new files with `./install link`, run `/reload` in Pi. On both Linux
and macOS, verify `/save-md`, `/skill:herdr`, and `/skill:context7-mcp` are available;
check startup diagnostics and `/skills-toggle` for the intended collection filters.

## Caps Lock shortcuts on Linux

`home/.config/keyd/common` recreates the Karabiner navigation and media
shortcuts: tap Caps Lock for Escape; hold it with A/D for Home/End, W/S for
Page Up/Down, Space for play/pause, Up/Down for volume, and Left/Right for
previous/next track. This is a named layer, not Ctrl+Alt+Shift+Super; unmapped
keys do not send four modifiers.

`default.conf` explicitly matches this MacBook's built-in keyboard, leaving its
modifiers unchanged. `quefrency.conf` matches both Quefrency Rev. 6 typing
interfaces and swaps Alt/Super on both sides (ordinary Alt, not AltGr). The full
IDs from `sudo keyd monitor` exclude trackpads, mice, and consumer controls.
Other keyboards are unchanged; add their IDs deliberately if needed.

On Arch, `./install` installs keyd and activates its configuration. If keyd is
already installed, `./install link` is sufficient. On Linux, the linking step
creates `/etc/keyd` as a symlink to this repo (replacing only an empty directory),
checks the config, enables the service, and reloads keyd. Existing nonempty or
unrelated configurations are left untouched with a warning; review and back them
up before moving them aside and rerunning. macOS and `DOT_HOME` test installs skip
system keyd setup.

Link the whole directory directly to the repo: keyd rejects includes that resolve
outside their config directory, so individual file symlinks will not work here.
The home config links are harmless on macOS; keyd is only used on Linux.

Before activation, back up `~/.config/hypr/input.lua` and remove its old
Quefrency `altwin:swap_alt_win` device overrides; keyd now owns that swap. Leave
other input settings alone. Run `hyprctl reload` and `hyprctl configerrors`.

After edits, run `keyd check` (including checking for warnings), then
`sudo keyd reload`. Check `journalctl -u keyd -b` for the expected device matches.
Test Caps alone and all nine shortcuts on both keyboards, check both sides of
the modifier row, and reconnect the Quefrency. Confirm mice/trackpad still work.
Hardware or firmware changes may require updating the interface IDs.

To undo, run `sudo systemctl disable --now keyd`, restore the saved Hyprland
input config, and reload Hyprland. keyd's emergency exit is Backspace+Escape+Enter.

## Per-machine config

On unixy systems you can put system specific configuration in ~/.files/sys.sh and they will also be sourced.

## Currently used on

 - macOS
- Ubuntu
- Arch Linux

The `bin/` directory also includes tmux and Herdr sessionizers plus small cleanup and dependency utilities.
