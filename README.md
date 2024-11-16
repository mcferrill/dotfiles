# mcferrill's dotfiles

This is a set of config files mostly starting with "." (hence the repo name)
that allow consistent behavior between multiple tools across environments. Uses [dotbot](https://github.com/anishathalye/dotbot)

## Prerequisites for Windows

- [Python](https://www.python.org/)
- [Powershell](https://learn.microsoft.com/en-us/powershell/)
- [Scoop](https://scoop.sh/)
- [WSL2](https://learn.microsoft.com/en-us/windows/wsl/install) & Ubuntu (optional)

## Installing and Updating

Clone the repo (eg. to $HOME/.files or $HOME/dotfiles) and install with:

Run `./install` to use the bash script or `./install.ps1` if using powershell on windows.
Configuration for this is in config/install.conf.yaml.

Add "update" to update dotfiles, submodules, and system as in `./install update`. This is configured in config/update.conf.yaml.

**Note:** On windows you'll need to manually copy config/profile.ps1 to $PROFILE.

## Tools Configured

- Powershell (windows), zsh+oh-my-zsh (everything else) - shell autocomplete, history search, etc.
- [starship](https://starship.rs/) - terminal styling
- [Git](https://git-scm.com/) - source code management
- Tmux & plugins via tpm - terminal multiplexer (splits/tabs, etc)
- [Neovim](https://neovim.io/) & plugins - telescope, lsps, formatting (based on [kickstart.nvim](https://github.com/nvim-lua/kickstart.nvim))
- [wezterm](https://wezfurlong.org/wezterm/) - cross platform terminal emulator
- macos
  - [karabiner](https://karabiner-elements.pqrs.org/) - keyboard customization (more easily generated with [this](https://github.com/mxstbr/karabiner))
  - [aerospace](https://github.com/nikitabobko/AeroSpace) - window manager (like i3)

**Note:** I had to install mingw on windows to provide a c compiler to neovim

## Per-machine config

On unixy systems you can put system specific configuration in ~/.files/sys.sh and they will also be sourced.

## Currently used on

- macOS
- Ubuntu
- Windows 11 (powershell & WSL2)
