
export VISUAL=nvim
export TMUX_PLUGIN_MANAGER_PATH='~/.config/tmux/plugins/tpm'

# System specific settings
if [ -f $DOTFILES/sys.sh ]; then
    . $DOTFILES/sys.sh
fi

# Cargo
export PATH=$HOME/.cargo/bin:$PATH

# Python (virtualenvwrapper, pip, etc.)
WORKON_HOME=$HOME/.envs
PIP_VIRTUALENV_BASE=$WORKON_HOME
PIP_RESPECT_VIRTUALENV=true

export VIRTUALENVWRAPPER_PYTHON=$(which python3)
if command -v virtualenvwrapper.sh &> /dev/null; then
    source "$(which virtualenvwrapper.sh)"
fi

# mise (handles tool versions)
if command -v mise &> /dev/null; then
  eval "$(mise activate zsh --shims)"
fi

