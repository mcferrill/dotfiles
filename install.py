#!/usr/bin/env python

from os.path import dirname, abspath, basename, join, splitext
import glob
import sys
import os

# Constants
home = os.environ.get('HOME')
repo = join(home, '.files')
backup = join(home, 'dotfiles.old')


def symlink(source, target):
    """Create a symlink to source called target without deleting old files."""

    if os.path.exists(target) or os.path.islink(target):
        if not os.path.exists(backup):
            os.makedirs(backup)
        print '\tBacking up old %s' % basename(target)
        os.rename(target, join(backup, basename(target)))

    print '\tLinking %s to %s' % (target, source)
    os.system('ln -s "%s" "%s"' % (source, target))


def main():

    # Move to the directory above the script's location (home folder)
    os.chdir(home)

    # Rename our directory to our repo constant.
    os.rename(basename(dirname(__file__)), repo)

    # Create a "junction" (symlink-like) to home/bin.
    if sys.platform in ('win32', 'cygwin'):
        os.system(join(repo, 'bin', 'junction.exe') + ' bin ' +
                  join(repo, 'bin'))

    # Windows
    if sys.platform == 'win23':
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
            symlink(script,
                    join('bin', splitext(basename(script))[0]))

        # Link all the dotfiles into the home directory.
        for config in glob.glob(join(repo, 'dot', '*')):
            symlink(config, join(home, '.' + basename(config)))
        #os.system('rm -rf .bashrc .profile .Vvim .vimrc')
        #os.system('ln -s .files/.bashrc .bashrc')
        #os.system('ln -s .files/.bashrc .profile')
        #os.system('ln -s .files/.vim .vim')
        #os.system('ln -s .files/.vimrc .vimrc')
        #os.system('ln -s .files/gitignore .gitignore')
        #os.system('ln -s .files/.gitconfig .gitconfig')

if __name__ == '__main__':
    main()
