# .bashrc

# Source global definitions
if [ -f /etc/bashrc ]; then
	. /etc/bashrc
fi
alias ls="ls --color"
alias ll="ls -l"
alias la="ls -A"
alias cls="clear"
alias python="python2.7"
alias vim=$HOME/bin/vim
export VISUAL='vim'

PATH=$PATH:$HOME/bin

# User specific aliases and functions
