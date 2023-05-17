# mcferrill's dotfiles

This is a set of config files mostly starting with "." (hence the repo name)
that allow consistent behavior between multiple tools across environments. Uses [dotbot](https://github.com/anishathalye/dotbot)

Install with::

    git clone <repo> .files && .files/install

## Manual installs (optional)

* macOS
  * [Homebrew](https://brew.sh/)
  * iterm2
* Windows
  * [scoop](https://scoop.sh/)
  * [Windows Terminal Preview](https://www.microsoft.com/en-us/p/windows-terminal-preview/9n8g5rfz9xk3#activetab=pivot:overviewtab)
* [Python](https://www.python.org/) (update-alternatives on linux)
* Fira Code NF from [NerdFonts](https://www.nerdfonts.com/)
* [Visual Studio Code](https://code.visualstudio.com/) (settings synced elsewhere)
* [neovim](https://neovim.io/)
* [ag/the-silver-searcher](https://github.com/ggreer/the_silver_searcher)

## Tools Configured Here

* Zsh
* Bash
* Vim/neovim
* Tmux
* Virtualenvwrapper
* Pip
* Git
* iterm2 (mac)
* Windows Terminal

## Per-machine config

You can put system specific configuration in ~/.files/sys.sh and they will also be sourced.

## Currently used on

* Ubuntu
* Windows 10 (powershell & WSL)
* macOS w/ iterm2
