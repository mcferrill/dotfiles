
export VISUAL=nvim

# System specific settings
if [ -f $DOTFILES/sys.sh ]; then
    . $DOTFILES/sys.sh
fi

# starship
if command -v starship &> /dev/null
then
    eval "$(starship init zsh)"
fi
