# mcferrill's dotfiles

This is a set of config files mostly starting with "." (hence the repo name)
that allow consistent behavior between multiple tools across environments. Uses the repository's native `install` tool.

## Installing and Updating

Clone the repo (eg. to $HOME/.files or $HOME/dotfiles) and install with:

`./install`

With no command, `./install` performs an idempotent, non-destructive installation.

Use `./install update` to update dotfiles, submodules, packages, and plugins.

Use `./install link`, `./install unlink`, `./install packages`, or `./install doctor` for individual operations. Use `./install help` for command help. Add `--dry-run` to inspect changes without applying them.

Managed home files live under `home/` and mirror paths below `$HOME`. Platform-specific files live under `home-darwin/`, `home-ubuntu/`, or `home-arch/`. The linker walks these trees recursively and refuses to replace unmanaged files.

## Secrets

Some things like SSH keys or private configs shouldn't be used. You can use a secrets manager like bitwarden to store and sync these items.

## Tools Configured

- zsh+[oh-my-zsh](https://ohmyz.sh/) - shell autocomplete, history search, etc.
- [starship](https://starship.rs/) - terminal styling
- [Git](https://git-scm.com/) - source code management
- Tmux & plugins via tpm - terminal multiplexer (splits/tabs, etc)
- [herdr](https://herdr.dev/) - a tmux-like multiplexer made for agents
- [Neovim](https://neovim.io/) & plugins - telescope, lsps, formatting (based on [kickstart.nvim](https://github.com/nvim-lua/kickstart.nvim))
- [wezterm](https://wezfurlong.org/wezterm/) - cross platform terminal emulator
- macos
  - [karabiner](https://karabiner-elements.pqrs.org/) - keyboard customization (more easily generated with [this](https://github.com/mxstbr/karabiner))
  - [aerospace](https://github.com/nikitabobko/AeroSpace) - window manager (like i3)

## Per-machine config

On unixy systems you can put system specific configuration in ~/.files/sys.sh and they will also be sourced.

## Currently used on

- macOS
- Ubuntu
