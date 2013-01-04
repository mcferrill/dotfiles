#!/usr/bin/env python

from os.path import dirname, abspath, basename, join, splitext
import glob
import sys
import os


def main():

    # Move to the directory above the script's location (home folder)
    os.chdir(dirname(dirname(abspath(__file__))))

    # Rename our directory to .files
    os.rename(basename(dirname(__file__)), '.files')

    # Create a "junction" (symlink-like) to home/bin.
    if sys.platform in ('win32', 'cygwin'):
        os.system(r'.files/bin/junction.exe bin .files/bin')

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
        for script in glob.glob(os.path.abspath('.files/bin') + '/*.py'):
            if 'py2exe' in script:
                continue
            os.system('ln -s %s bin/%s' % (script,
                                           splitext(basename(script))[0]))

        # Link the bash and vim settings.
        os.system('rm -rf .bashrc .profile .vim .vimrc')
        os.system('ln -s .files/.bashrc .bashrc')
        os.system('ln -s .files/.bashrc .profile')
        os.system('ln -s .files/.vim .vim')
        os.system('ln -s .files/.vimrc .vimrc')
        os.system('ln -s .files/gitignore .gitignore')
        os.system('ln -s .files/.gitconfig .gitconfig')

if __name__ == '__main__':
    main()
