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

## Caps Lock shortcuts on Linux

`home/.config/keyd/default.conf` recreates the Karabiner navigation and media
shortcuts: tap Caps Lock for Escape; hold it with A/D for Home/End, W/S for
Page Up/Down, Space for play/pause, Up/Down for volume, and Left/Right for
previous/next track. This is a named layer, not Ctrl+Alt+Shift+Super; unmapped
keys do not send four modifiers. The config is linked on every platform but
only used by keyd on Linux.

On Arch, install keyd with `sudo pacman -S --needed keyd`, then run `./install link`.
Activate it once (do not replace an existing `/etc/keyd/default.conf` without
reviewing it):

```sh
sudo mkdir -p /etc/keyd
sudo ln -s "$HOME/.config/keyd/default.conf" /etc/keyd/default.conf
sudo systemctl enable --now keyd
```

After edits, run `sudo keyd reload`. Test Caps alone and each shortcut in an
editor/media player. To undo, run `sudo systemctl disable --now keyd`.

The config matches all keyboards. keyd exposes a virtual keyboard, so existing
Hyprland device-specific settings (such as Quefrency Alt/Super swaps) may no
longer match; reconcile those before enabling it. To preserve per-keyboard
behavior, use device-specific keyd configs rather than a global Alt/Super swap.

## Per-machine config

On unixy systems you can put system specific configuration in ~/.files/sys.sh and they will also be sourced.

## Currently used on

 - macOS
- Ubuntu
- Arch Linux

The `bin/` directory also includes tmux and Herdr sessionizers plus small cleanup and dependency utilities.
