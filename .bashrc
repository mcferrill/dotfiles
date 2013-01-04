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
alias vimdiff=$HOME/bin/vimdiff
export VISUAL='vim'

PATH=$PATH:$HOME/bin

# Git tab completion and prompt.

source $HOME/.files/git-completion.bash
source $HOME/.files/git-colors.sh
source $HOME/.files/git-prompt.sh
GIT_PS1_SHOWDIRTYSTATE=1
GIT_PS1_SHOWUNTRACKEDFILES=1
GIT_PS1_SHOWSTASHSTATE=1
#GIT_PS1_SHOWUPSTREAM="auto"
