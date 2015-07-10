dotfiles
========

This is a set of config files mostly starting with "." (hence the repo name)
that allow consistent behavior between multiple tools across environments.

Tools
-----
* Python
* Vim
* GNU Screen
* Virtualenvwrapper
* Pip

Additional Dependencies
-----------------------
* Python support for vim
* ncurses (for clearing the screen)

Installation
------------
After installing dependencies run "python dotfiles/install.py" and the
installer should run. You may need to put some more config variables (specifically
virtualenvwrapper related stuff) in a dotfiles (or .files) /sys.sh file.

Supported Platforms
-------------------
Currently used on:

* CentOS (webfaction)
* Ubuntu
* Cygwin (windows 8)
* Mac OSX 10.10 (note: ensure "terminal->prefs->profiles->terminal->save lines
  to scrollback when an app status bar is present" is enabled to get mouse
scrolling within screen

Suggestions are welcome.
