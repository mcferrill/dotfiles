
export VISUAL=nvim
export TMUX_PLUGIN_MANAGER_PATH='~/.config/tmux/plugins/tpm'

# System specific settings
if [ -f $DOTFILES/sys.sh ]; then
    . $DOTFILES/sys.sh
fi

# Python (virtualenvwrapper, pip, etc.)
WORKON_HOME=$HOME/.envs
PIP_VIRTUALENV_BASE=$WORKON_HOME
PIP_RESPECT_VIRTUALENV=true

export VIRTUALENVWRAPPER_PYTHON=$(which python3)
if [ "$(which virtualenvwrapper.sh)" ]; then
    source "$(which virtualenvwrapper.sh)"
fi

# fnm (rust-based nvm/n alternative)
if command -v fnm &> /dev/null; then
  eval "$(fnm env --use-on-cd)"
fi

