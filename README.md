dotfiles
========

This is a set of config files mostly starting with "." (hence the repo name)
that allow consistent behavior between multiple tools across environments.

Requirements
------------
The only real dependencies are python and git. More tools that are configured:

* Zsh
* Bash
* Vim
* Tmux
* GNU Screen
* Virtualenvwrapper
* Pip
* Git

Installation
------------
Run "python dotfiles/install.py" and the installer should run. You can put
system specific configuration in ~/.files/sys.sh and they will also be sourced.

Supported Platforms
-------------------
Currently used on:

* Ubuntu
* CentOS
* Windows Subsystem for Linux (Ubuntu)
* macOS 10.15 w/ iterm2

To Do
-----
* Include sys.sh (platform-specific settings) and have install script select
based on reported platform.
* Make python3 default "python" with python2 and python3 aliases as needed.
