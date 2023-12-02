# mcferrill's dotfiles

This is a set of config files mostly starting with "." (hence the repo name)
that allow consistent behavior between multiple tools across environments. Uses [dotbot](https://github.com/anishathalye/dotbot)

Install with:

    git clone <repo> .files && .files/install

## Manual installs (optional)

* Windows
  * [scoop](https://scoop.sh/)
  * [Windows Terminal Preview](https://www.microsoft.com/en-us/p/windows-terminal-preview/9n8g5rfz9xk3#activetab=pivot:overviewtab)
* [Visual Studio Code](https://code.visualstudio.com/) (settings synced elsewhere)

## Tools Configured Here

* Prompts
  * Zsh + oh-my-zsh & plugins (autocomplete, history search, etc.)
  * Bash
  * starship (prompt & styling for both of the above)
* Git
* Tmux & tmate (terminal multiplexing & sharing)
* Vim/neovim & plugins
* karabiner (macos keyboard customization) - more easily generated with [this](https://github.com/mxstbr/karabiner)

## Per-machine config

You can put system specific configuration in ~/.files/sys.sh and they will also be sourced.

## Currently used on

* macOS w/ iterm2
* Ubuntu
* Windows 11 (powershell & WSL2)
