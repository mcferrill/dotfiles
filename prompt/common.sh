
export VISUAL=vim

# System specific settings
if [ -f $DOTFILES/sys.sh ]; then
    . $DOTFILES/sys.sh
fi
