
export DOTFILES="${HOME}/.files"

source "${DOTFILES}/prompt/environment.sh"
source "${DOTFILES}/prompt/aliases.zsh"

autoload -Uz compinit
compinit

# Make completion matching case-insensitive without changing the typed or
# completed path casing.
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Z}' 'm:{a-z}={A-Z} l:|=* r:|=*'

bindkey -s '^f' "tmux-sessionizer\n"

if (( $+commands[mise] )); then
    eval "$(mise activate zsh)"
fi

if (( $+commands[starship] )); then
    eval "$(starship init zsh)"
fi

source "${DOTFILES}/prompt/plugins.zsh"

# Walk through all history when the line starts empty; otherwise search by prefix.
bindkey -e
typeset -g _history_navigation_mode=0
typeset -g _history_search_prefix=''

_history_reset_navigation_mode() {
    _history_navigation_mode=0
    _history_search_prefix=''
}

_history_up_or_prefix_search() {
    if (( _history_navigation_mode == 1 )) || [[ -z $BUFFER ]]; then
        _history_navigation_mode=1
        zle up-line-or-history
    else
        if (( _history_navigation_mode != 2 )); then
            _history_search_prefix=$BUFFER
            _history_navigation_mode=2
        fi
        BUFFER=$_history_search_prefix
        CURSOR=${#BUFFER}
        zle history-beginning-search-backward
        zle end-of-line
    fi
}

_history_down_or_prefix_search() {
    if (( _history_navigation_mode == 1 )) || [[ -z $BUFFER ]]; then
        _history_navigation_mode=1
        zle down-line-or-history
    else
        if (( _history_navigation_mode != 2 )); then
            _history_search_prefix=$BUFFER
            _history_navigation_mode=2
        fi
        BUFFER=$_history_search_prefix
        CURSOR=${#BUFFER}
        zle history-beginning-search-forward
        zle end-of-line
    fi
}

zle -N _history_up_or_prefix_search
zle -N _history_down_or_prefix_search
autoload -Uz add-zle-hook-widget
add-zle-hook-widget zle-line-init _history_reset_navigation_mode

for keymap in emacs viins; do
    bindkey -M "$keymap" '^[[A' _history_up_or_prefix_search
    bindkey -M "$keymap" '^[[B' _history_down_or_prefix_search
    bindkey -M "$keymap" '^[OA' _history_up_or_prefix_search
    bindkey -M "$keymap" '^[OB' _history_down_or_prefix_search
    bindkey -M "$keymap" '^P' _history_up_or_prefix_search
    bindkey -M "$keymap" '^N' _history_down_or_prefix_search
done

if (( $+commands[op] )); then
    source <(op completion zsh)
fi
