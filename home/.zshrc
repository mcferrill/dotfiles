
export DOTFILES="${HOME}/.files"

source "${DOTFILES}/prompt/environment.sh"
source "${DOTFILES}/prompt/aliases.zsh"

autoload -Uz compinit
compinit

bindkey -s '^f' "tmux-sessionizer\n"

if (( $+commands[mise] )); then
    eval "$(mise activate zsh)"
fi

if (( $+commands[starship] )); then
    eval "$(starship init zsh)"
fi

source "${DOTFILES}/prompt/plugins.zsh"

if (( $+commands[op] )); then
    source <(op completion zsh)
fi
