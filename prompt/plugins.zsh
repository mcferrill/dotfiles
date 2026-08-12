local plugin_dir="${DOTFILES}/prompt/zsh-plugins/plugins"

if [[ -r "${plugin_dir}/zsh-autosuggestions/zsh-autosuggestions.zsh" ]]; then
    source "${plugin_dir}/zsh-autosuggestions/zsh-autosuggestions.zsh"
fi

if [[ -r "${plugin_dir}/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh" ]]; then
    source "${plugin_dir}/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh"
fi

autoload -Uz add-zsh-hook
add-zsh-hook precmd _prompt_colored_man_pages

_prompt_colored_man_pages() {
    [[ -t 1 ]] || return
    export LESS_TERMCAP_mb=$'\e[1;31m'
    export LESS_TERMCAP_md=$'\e[1;36m'
    export LESS_TERMCAP_me=$'\e[0m'
    export LESS_TERMCAP_so=$'\e[1;44;33m'
    export LESS_TERMCAP_se=$'\e[0m'
    export LESS_TERMCAP_us=$'\e[1;32m'
    export LESS_TERMCAP_ue=$'\e[0m'
}
