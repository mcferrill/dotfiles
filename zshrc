
zmodload zsh/zprof

export DOTFILES=$HOME/.files
export PATH=$DOTFILES/bin:$PATH
export PATH=$PATH:~/.local/bin

# Shared settings for bash & zsh
. $DOTFILES/prompt/common.sh

# Python (virtualenvwrapper, pip, etc.)
WORKON_HOME=$HOME/.envs
PIP_VIRTUALENV_BASE=$WORKON_HOME
PIP_RESPECT_VIRTUALENV=true
export VIRTUALENVWRAPPER_PYTHON=$(which python3)
if [ "$VIRTUAL_ENV" ]; then
    source $VIRTUAL_ENV/bin/activate;
elif [ "$(which virtualenvwrapper.sh)" ]; then
    source "$(which virtualenvwrapper.sh)"
fi

autoload -Uz compinit && compinit

# oh-my-zsh
export ZSH=$DOTFILES/prompt/oh-my-zsh
export ZSH_CUSTOM=$DOTFILES/prompt/zsh-plugins
plugins=(colored-man-pages colorize zsh-syntax-highlighting zsh-autosuggestions)
export ZSH_COLORIZE_STYLE=github-dark
source $ZSH/oh-my-zsh.sh

# Shared aliases, etc.
. $DOTFILES/prompt/aliases.sh

# asdf (assumes linuxbrew by default)
ASDF="/home/linuxbrew/.linuxbrew/opt/asdf/libexec/asdf.sh"
if [[ "$OSTYPE" == "darwin"* ]]; then
    ASDF="/opt/homebrew/opt/asdf/libexec/asdf.sh"
fi
if [ -f $ASDF ]; then
   . $ASDF
fi

