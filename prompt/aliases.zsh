if [[ "$OSTYPE" == darwin* ]]; then
    alias ls='ls -G'
else
    alias ls='ls --color=auto'
fi

alias vim='nvim'
alias ll='ls -lh'
alias la='ls -A'
alias tree='tree -C'
alias lg='lazygit'
