
export DOTFILES=$HOME/.files
export PATH=$DOTFILES/bin:$PATH

# Source global definitions
if [ -f /etc/bashrc ]; then
    . /etc/bashrc
fi

# Shared settings for bash & zsh
source $DOTFILES/prompt/common.sh

# Python (virtualenvwrapper, pip, etc.)
WORKON_HOME=$HOME/.envs
PIP_VIRTUALENV_BASE=$WORKON_HOME
PIP_RESPECT_VIRTUALENV=true
if [ "$(which virtualenvwrapper.sh)" ]; then
    source "$(which virtualenvwrapper.sh)"
fi
if [ "$VIRTUAL_ENV" ]; then
    source $VIRTUAL_ENV/bin/activate;
fi

# Shared aliases, etc.
source $DOTFILES/prompt/aliases.sh
