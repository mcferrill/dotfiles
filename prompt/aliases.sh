
alias mv="mv -i"
alias rm="rm -i"
alias cp="cp -i"
alias ls="ls --color"
alias ll="ls -l"
alias la="ls -A"
alias cls="clear"
alias tree="tree -C"
alias free="free -th"
alias grep="grep --color -n"

export VISUAL=vim

# System specific settings
if [ -f $DOTFILES/sys.sh ]; then
    source $DOTFILES/sys.sh
fi
