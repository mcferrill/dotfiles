dotfiles
========

This is a set of config files mostly starting with "." (hence the repo name)
that allow consistent behavior between multiple tools across environments.

Requirements
------------
The only real requirements for this to install are python and pip. More tools
that are configured:

* Python
* Vim
* GNU Screen
* Virtualenvwrapper
* Pip

Installation
------------
Run "python dotfiles/install.py" and the installer should run. You may need to
put some more config variables (specifically virtualenvwrapper related stuff)
in a dotfiles (or .files) /sys.sh file.

Supported Platforms
-------------------
Currently used on:

* CentOS
* Ubuntu
* Cygwin
* Mac OSX 10.10 (note: ensure "terminal->prefs->profiles->terminal->save lines
  to scrollback when an app status bar is present" is enabled to get mouse
scrolling within screen

Suggestions are welcome.
