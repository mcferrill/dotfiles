#!/usr/bin/env python

'''usage: install.py [options]

Options:
    -u, --update         Pull updates for submodules.
    -f, --force          Force overwrite of existing files (no backup).
'''

from __future__ import print_function
from os.path import dirname, abspath, basename, join, splitext
from glob import glob
import os
import sys

from docopt import docopt

# Constants
home = os.environ.get('HOME', os.environ.get('USERPROFILE'))
cur = dirname(abspath(__file__))
repo = join(home, '.files')
backup_dir = join(home, 'dotfiles.old')


def symlink(source, target, backup=True):
    """Create a symlink "target" for "source" without deleting old files."""

    if os.path.exists(target) or os.path.islink(target):
        if backup:
            if not os.path.exists(backup_dir):
                os.makedirs(backup_dir)
            print('Backing up old %s' % basename(target))
            os.rename(target, join(backup_dir, basename(target)))
        else:
            os.remove(target)

    print('Linking %s to %s' % (target, source))
    os.system('ln -s "%s" "%s"' % (source, target))


def install(args):
    """Pull latest from github and symlink everything. Optionally backs up any
    overwritten config files.
    """

    print('Downloading latest from github...')
    os.chdir(cur)
    os.system('git fetch origin')
    os.system('git merge origin/master')

    if args['--update']:
        os.system('git submodule foreach git pull origin master')
        print('Be sure to push updates if needed')

    print('Installing')
    os.chdir(home)

    # Install to our repo constant (.files).
    if repo != cur:
        os.rename(cur, repo)

    # Windows (not recently tested)
    if sys.platform == 'win32':

        # Create a "junction" (windows symlink) to home/bin.
        os.system(join(repo, 'bin', 'junction.exe') + ' bin ' +
                  join(repo, 'bin'))

        # Add home/bin to our system path.
        os.system('SET PATH=%%PATH%%;%s' % join(abspath(os.curdir)))

        # Add the .py extension to the system pathext variable so we can call
        # python scripts directly.
        os.system('SET PATHEXT=%%PATHEXT%%;.PY')

    # Unix-based
    else:

        if sys.platform == 'darwin':
            os.system('brew update && brew upgrade')

        elif sys.platform == 'linux' and os.system('which apt') == 0:
            os.system('sudo apt update && sudo apt upgrade -y')
            os.system('sudo apt autoremove -y && sudo apt autoclean')

        backup = not args['--force']

        # Make sure home/bin exists.
        if not os.path.exists('bin'):
            os.makedirs('bin')

        # Link all of the scripts into home/bin.
        bin_dir = abspath(join(repo, 'bin'))
        scripts = glob(bin_dir + '/*.py') + glob(bin_dir + '/*.sh')
        for script in scripts:
            script_name, _ = splitext(basename(script))
            symlink(script, join('bin', script_name), backup)

        # Link all the dotfiles into the home directory.
        for config in glob(join(repo, 'dot', '*')):
            symlink(config, join(home, '.' + basename(config)), backup)

    # Install git submodules.
    print('Installing sub-modules.')
    os.chdir(repo)
    os.system('git submodule init && git submodule update')

    # Check pip for outdated packages
    os.system('python2 -m pip list --outdated')
    os.system('python3 -m pip list --outdated')

    print('''Installation complete!
To install additional python extras use: pip install -r \
requirements.txt''')


if __name__ == '__main__':
    args = docopt(__doc__)

    install(args)
