#!/usr/bin/env sh

export VISUAL="${VISUAL:-nvim}"
export PATH="${DOTFILES}/bin:${HOME}/.local/bin:${HOME}/.cargo/bin:${PATH}"
export WORKON_HOME="${HOME}/.envs"
export PIP_VIRTUALENV_BASE="${WORKON_HOME}"
export PIP_RESPECT_VIRTUALENV=true

if [ -f "${DOTFILES}/sys.sh" ]; then
    . "${DOTFILES}/sys.sh"
fi
