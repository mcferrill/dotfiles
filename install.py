#!/usr/bin/env python

from os.path import dirname, abspath, basename, join, splitext
import glob
import sys
import os

# Constants
home = os.environ.get('HOME', os.environ.get('USERPROFILE'))
repo = join(home, '.files')
backup = join(home, 'dotfiles.old')


def symlink(source, target):
    """Create a symlink to source called target without deleting old files."""

    if os.path.exists(target) or os.path.islink(target):
        if not os.path.exists(backup):
            os.makedirs(backup)
        print 'Backing up old %s' % basename(target)
        os.rename(target, join(backup, basename(target)))

    print 'Linking %s to %s' % (target, source)
    os.system('ln -s "%s" "%s"' % (source, target))


def install():

    # Move to the directory above the script's location (home folder)
    os.chdir(home)

    # Rename our directory to our repo constant.
    if not repo.endswith(dirname(__file__)):
        os.rename(basename(dirname(__file__)), repo)

    # Windows
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
        symlink(abspath(join(repo, 'bin', 'cloc')), join('bin', 'cloc'))

        # Link all the dotfiles into the home directory.
        for config in glob.glob(join(repo, 'dot', '*')):
            symlink(config, join(home, '.' + basename(config)))

    if '-ns' not in sys.argv:
        print 'Installing sub-modules.'
        os.chdir(repo)
        os.system('git submodule init')
        os.system('git submodule update')

    if '-np' not in sys.argv:
        print 'Installing additional python packages.'
        os.system('sudo pip install -r requirements.txt')

    print 'Installation complete!'


def help():
    print 'usage: install.py [-ns] [-np]\n-ns: don\'t install submodules\
\n-np: don\'t install pip extras'


def main():
    if '-h' in sys.argv:
        help()
    else:
        install()


if __name__ == '__main__':
    main()
