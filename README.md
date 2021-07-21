dotfiles
========

This is a set of config files mostly starting with "." (hence the repo name)
that allow consistent behavior between multiple tools across environments.

Prerequisites
-------------

* Python 3.6+
* git

Manual installs (optional)
--------------------------

* Fira Code NF from [NerdFonts](https://www.nerdfonts.com/)
* [Visual Studio Code](https://code.visualstudio.com/) (settings synced elsewhere)
* [neovim](https://neovim.io/)
* [ag/the-silver-searcher](https://github.com/ggreer/the_silver_searcher)
* [Python](https://www.python.org/) (update-alternatives on linux)
* macOS
  * [Homebrew](https://brew.sh/)
  * iterm2
* Windows
  * [Windows Terminal Preview](https://www.microsoft.com/en-us/p/windows-terminal-preview/9n8g5rfz9xk3#activetab=pivot:overviewtab)
  * [winget](https://github.com/microsoft/winget-cli/releases) or [scoop](https://scoop.sh/)

Tools Configured Here
---------------------

The only real dependencies are python and git. More tools that are configured:

* Zsh
* Bash
* Vim/neovim
* Tmux
* Virtualenvwrapper
* Pip
* Git
* iterm2 (mac)
* Windows Terminal

Installation
------------

Run "python dotfiles/install.py" and the installer should run. You can put
system specific configuration in ~/.files/sys.sh and they will also be sourced.

Supported Platforms
-------------------

Currently used on:

* Ubuntu
* Windows 10 (powershell & WSL)
* macOS w/ iterm2
