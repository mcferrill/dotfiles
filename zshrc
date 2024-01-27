
export DOTFILES=$HOME/.files
export PATH=$DOTFILES/bin:$PATH:~/.local/bin

# Shared settings for bash & zsh
. $DOTFILES/prompt/common.sh

autoload -Uz compinit && compinit
bindkey -s ^f "tmux-sessionizer\n"

# oh-my-zsh
export ZSH=$DOTFILES/prompt/oh-my-zsh
export ZSH_CUSTOM=$DOTFILES/prompt/zsh-plugins
plugins=(colored-man-pages colorize zsh-syntax-highlighting zsh-autosuggestions)
export ZSH_COLORIZE_STYLE=github-dark
source $ZSH/oh-my-zsh.sh

# starship
if command -v starship &> /dev/null
then
    eval "$(starship init zsh)"
fi

# Shared aliases, etc.
. $DOTFILES/prompt/aliases.sh

