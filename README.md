dotfiles
========

This is a set of config files mostly starting with "." (hence the repo name)
that allow consistent behavior between multiple tools across environments.

Prerequisites
-------------
Python 3.6+
git

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

To Do
-----
* Include sys.sh (platform-specific settings) and have install script select
based on reported platform.
