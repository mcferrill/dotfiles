#!/usr/bin/env python

'''usage: install.py [options]

Options:
    -u, --update         Pull updates for submodules.
    -f, --force          Force overwrite of existing files (no backup).
    -ns, --no-system     Skip system (apt/brew/yum) updates.
    -nd, --no-download   Skip any network-dependent steps.
    -np, --no-pip        Skip python modules.
'''

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


def main(args):
    """Pull latest from github and symlink everything. Optionally backs up any
    overwritten config files.
    """

    # Parse commandline args
    args = docopt(__doc__)
    backup = not args['--force']

    # Pull core and submmodule updates from github
    if not args['--no-download']:
        print('Downloading latest version from github...')
        os.chdir(cur)
        os.system('git fetch origin')
        os.system('git merge origin/master')
        os.system('git submodule init && git submodule update')

        if not args['--no-pip']:
            print('Installing python modules')
            os.system('python -m pip install -r requirements.txt')

    # Install to REPO
    print('Installing to {}'.format(repo))
    os.chdir(home)
    if repo != cur:
        os.rename(cur, repo)

    if not args['--no-system'] and not args['--no-download']:
        print('Installing system updates')
        if sys.platform == 'darwin':
            os.system('brew update && brew upgrade')

        elif sys.platform.startswith('linux') and os.system('which apt') == 0:
            os.system('sudo apt update && sudo apt upgrade -y')
            os.system('sudo apt autoremove -y && sudo apt autoclean')

    # Windows (not recently tested)
    if sys.platform == 'win32':

        # Create a "junction" (windows symlink) to home/bin.
        os.system(join(repo, 'bin', 'junction.exe') + ' bin ' +
                  join(repo, 'bin'))
        
        print('Please add {} to your windows path'.format(os.path.join(repo, 'bin')))

    # Unix-based
    else:

        # Link all of the scripts into $HOME/bin.
        print('Installing scripts to ~/bin')
        if not os.path.exists('bin'):
            os.makedirs('bin')

        bin_dir = abspath(join(repo, 'bin'))
        scripts = glob(bin_dir + '/*.py') + glob(bin_dir + '/*.sh')
        for script in scripts:
            script_name, _ = splitext(basename(script))
            symlink(script, join('bin', script_name), backup)

        # Link all the dotfiles into the home directory.
        print('Linking remaining dotfiles')
        for config in glob(join(repo, 'dot', '*')):
            symlink(config, join(home, '.' + basename(config)), backup)

    # Check pip for outdated packages
    print('Checking pip for outdated packages')
    os.system('python -m pip list --outdated')

    print('Installation complete!')


if __name__ == '__main__':
    main()