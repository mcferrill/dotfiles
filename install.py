#!/usr/bin/env python

from os.path import dirname, abspath, basename, join, splitext
import glob
import os
import sys

# Constants
home = os.environ.get('HOME', os.environ.get('USERPROFILE'))
cur = dirname(abspath(__file__))
repo = join(home, '.files')
backup = join(home, 'dotfiles.old')


def symlink(source, target):
    """Create a symlink "target" for "source" without deleting old files."""

    if os.path.exists(target) or os.path.islink(target):
        if not os.path.exists(backup):
            os.makedirs(backup)
        print 'Backing up old %s' % basename(target)
        os.rename(target, join(backup, basename(target)))

    print 'Linking %s to %s' % (target, source)
    os.system('ln -s "%s" "%s"' % (source, target))


def install():

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
        for script in glob.glob(abspath(join(repo, 'bin', '*.py'))):
            if 'py2exe' in script:
                continue
            symlink(script, join('bin', splitext(basename(script))[0]))

        # Special handler for cloc (perl).
        symlink(join(repo, 'bin', 'cloc'), join('bin', 'cloc'))

        # Link all the dotfiles into the home directory.
        for config in glob.glob(join(repo, 'dot', '*')):
            symlink(config, join(home, '.' + basename(config)))

    # Install git submodules (optional).
    if '-n' not in sys.argv:
        print 'Installing sub-modules.'
        os.chdir(repo)
        os.system('git submodule init')
        os.system('git submodule update')

        if sys.platform == 'cygwin':
            os.system(
                'git clone https://github.com/transcode-open/apt-cyg.git')
            symlink(abspath(join(repo, 'apt-cyg', 'apt-cyg')),
                    abspath(join(home, 'bin', 'apt-cyg')))

    print '''Installation complete!
To install additional python extras use: pip install -r \
requirements.txt'''


def update():
    os.chdir(cur)
    print 'Downloading latest from bitbucket...'
    os.system('git fetch origin')
    os.system('git merge origin/master')
    print 'Installing'
    install()


def main():
    if '-h' in sys.argv:
        print 'usage: install.py [-n | -u]\n-n: don\'t install submodules\n\
-u: download latest from git (update)'
    elif '-u' in sys.argv:
        update()
    else:
        install()


if __name__ == '__main__':
    main()
