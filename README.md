# mcferrill's dotfiles

This is a set of config files mostly starting with "." (hence the repo name)
that allow consistent behavior between multiple tools across environments. Uses [dotbot](https://github.com/anishathalye/dotbot)

## Installing and Updating

Clone the repo (eg. to $HOME/.files or $HOME/dotfiles) and install with:

`./install`

Configuration for this is in config/install.conf.yaml.

Add "update" to update dotfiles, submodules, and system as in `./install update`. This is configured in config/update.conf.yaml.

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
