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
* Mac OSX 10.10 (note: ensure "terminal->prefs->profiles->terminal->save lines
  to scrollback when an app status bar is present" is enabled to get mouse
scrolling within screen)

Suggestions are welcome.
