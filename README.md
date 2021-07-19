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
* [winget](https://github.com/microsoft/winget-cli/releases)
* Fira Code NF from [NerdFonts](https://www.nerdfonts.com/)

Requirements
------------
The only real dependencies are python and git. More tools that are configured:

* Zsh
* Bash
* Vim
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
* CentOS
* macOS w/ iterm2
* Windows 10 (powershell & WSL)
