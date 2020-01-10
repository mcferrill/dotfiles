#!/usr/bin/env python

'''usage: install.py [options]

Options:
    -n, --no-submodules  Don't install submodules.
    -u, --update         Download latest from git (update).
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

    # Move to the home directory.
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

    # Install git submodules (optional).
    if not args['--no-submodules']:
        print('Installing sub-modules.')
        os.chdir(repo)
        os.system('git submodule init && git submodule update')

    print('''Installation complete!
To install additional python extras use: pip install -r \
requirements.txt''')


def update(args):
    """Pull latest updates from github before installing."""

    os.chdir(cur)

    print('Downloading latest from github...')
    os.system('git fetch origin')
    os.system('git merge origin/master')

    print('Installing')
    install(args)


if __name__ == '__main__':
    args = docopt(__doc__)

    if args['--update']:
        update(args)
    else:
        install(args)
