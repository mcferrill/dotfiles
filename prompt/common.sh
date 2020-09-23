
export VISUAL=vim

# System specific settings
if [ -f $DOTFILES/sys.sh ]; then
    source $DOTFILES/sys.sh
fi
