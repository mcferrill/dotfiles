
export VISUAL=nvim
export TMUX_PLUGIN_MANAGER_PATH='~/.config/tmux/plugins/tpm'

bindkey -s ^f "tmux-sessionizer\n"

# System specific settings
if [ -f $DOTFILES/sys.sh ]; then
    . $DOTFILES/sys.sh
fi

# starship
if command -v starship &> /dev/null
then
    eval "$(starship init zsh)"
fi
