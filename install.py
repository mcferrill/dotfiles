#!/usr/bin/env python

from os.path import dirname, abspath, basename, join, splitext
import glob
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
            print 'Backing up old %s' % basename(target)
            os.rename(target, join(backup_dir, basename(target)))
        else:
            os.remove(target)

    print 'Linking %s to %s' % (target, source)
    os.system('ln -s "%s" "%s"' % (source, target))


def install(args):

    # Move to the home directory.
    os.chdir(home)

    # Install to our repo constant (.files).
    if repo != cur:
        os.rename(cur, repo)

    # Windows (disabled for now)
    if sys.platform == 'win32':
        print 'This platform is currently not supported!'
        return

        # Create a "junction" (symlink-like) to home/bin.
        os.system(join(repo, 'bin', 'junction.exe') + ' bin ' +
                  join(repo, 'bin'))

        # Add home/bin to our system path.
        os.system('SET PATH=%%PATH%%;%s' % join(abspath(os.curdir)))

        # Add the .py extension to the system pathext variable so we can call
        # python scripts directly.
        os.system('SET PATHEXT=%%PATHEXT%%;.PY')

    # Unix-based
    else:

        # Make sure home/bin exists.
        if not os.path.exists('bin'):
            os.makedirs('bin')

        # Link all of the scripts into home/bin.
        for script in glob.glob(abspath(join(repo, 'bin', '*.py'))) + \
                glob.glob(abspath(join(repo, 'bin', '*.sh'))):
            symlink(script, join('bin', splitext(basename(script))[0]),
                    not args['--force'])

        # Special handler for cloc (perl).
        symlink(join(repo, 'bin', 'cloc'), join('bin', 'cloc'),
                not args['--force'])

        # Link all the dotfiles into the home directory.
        for config in glob.glob(join(repo, 'dot', '*')):
            symlink(config, join(home, '.' + basename(config)),
                    not args['--force'])

    # Install git submodules (optional).
    if not args['--no-submodules']:
        print 'Installing sub-modules.'
        os.chdir(repo)
        os.system('git submodule init')
        os.system('git submodule update')

        if sys.platform == 'cygwin':
            os.system(
                'git clone https://github.com/transcode-open/apt-cyg.git')
            symlink(abspath(join(repo, 'apt-cyg', 'apt-cyg')),
                    abspath(join(home, 'bin', 'apt-cyg')),
                    not args['--force'])

    print '''Installation complete!
To install additional python extras use: pip install -r \
requirements.txt'''


def update(args):
    os.chdir(cur)
    print 'Downloading latest from bitbucket...'
    os.system('git fetch origin')
    os.system('git merge origin/master')
    print 'Installing'
    install(args)


def main():
    usage = '''usage: install.py [options]

Options:
    -n, --no-submodules  Don't install submodules.
    -u, --update         Download latest from git (update).
    -f, --force          Force overwrite of existing files (no backup).
'''

    args = docopt(usage)

    if args['--update']:
        update(args)
    else:
        install(args)


if __name__ == '__main__':
    main()
