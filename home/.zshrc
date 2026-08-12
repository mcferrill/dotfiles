
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

# Search history entries that begin with the text already typed. Bind both
# common terminal encodings for the arrow keys after plugins load.
bindkey -e
_history_beginning_search_backward_end() {
    zle history-beginning-search-backward
    zle end-of-line
}

_history_beginning_search_forward_end() {
    zle history-beginning-search-forward
    zle end-of-line
}

zle -N _history_beginning_search_backward_end
zle -N _history_beginning_search_forward_end

for keymap in emacs viins; do
    bindkey -M "$keymap" '^[[A' _history_beginning_search_backward_end
    bindkey -M "$keymap" '^[[B' _history_beginning_search_forward_end
    bindkey -M "$keymap" '^[OA' _history_beginning_search_backward_end
    bindkey -M "$keymap" '^[OB' _history_beginning_search_forward_end
    bindkey -M "$keymap" '^P' _history_beginning_search_backward_end
    bindkey -M "$keymap" '^N' _history_beginning_search_forward_end
done

if (( $+commands[op] )); then
    source <(op completion zsh)
fi
