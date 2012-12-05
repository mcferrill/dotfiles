#!/usr/bin/env python

import glob
import sys
import os

def main():

    # Move to the directory above the script's location (home folder)
    os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    # Rename our directory to .files
    os.rename(os.path.basename(os.path.dirname(__file__)), '.files')

    # Windows
    if sys.platform == 'win32':

        # Create a "junction" (symlink-like) to home/bin.
        os.system(r'.files\bin\junction.exe bin .files\bin')

        # Add home/bin to our system path.
        os.system('SET PATH=%%PATH%%;%s' % os.path.join(os.path.abspath(os.curdir)))

        # Add the .py extension to the system pathext variable so we can call
        # python scripts directly.
        os.system('SET PATHEXT=%%PATHEXT%%;.PY')

    # Unix-based
    else:

        # Make sure home/bin exists.
        if not os.path.exists('bin'): os.makedirs('bin')

        # Link all of the scripts into home/bin.
        for script in glob.glob('.files/bin/*.py'):
            if 'py2exe' in script: continue
            os.system('ln -s %s bin/%s' % (script, os.path.splitext(os.path.basename(script))[0]))

        # Link the bash and vim settings.
        os.system('rm -rf .bashrc .profile .vim .vimrc')
        os.system('ln -s .files/.bashrc .bashrc')
        os.system('ln -s .files/.bashrc .profile')
        os.system('ln -s .files/.vim .vim')
        os.system('ln -s .files/.vimrc .vimrc')

if __name__=='__main__': main()
