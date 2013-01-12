#!/usr/bin/env python

"""Remove common cached files (.pyc, <name>~, #<name>#, etc.)."""

import os
import sys


def walk(dirname=os.curdir):
    for basename in os.listdir(dirname):
        pathname = dirname + '/' + basename
        if os.path.isdir(pathname) and '-r' in sys.argv:
            walk(pathname)
        else:
            if basename.endswith('~'):
                os.remove(pathname)
            elif basename.endswith('~'):
                os.remove(pathname)
            elif basename.startswith('#') and basename.endswith('#'):
                os.remove(pathname)
            elif basename.endswith('.pyc'):
                os.remove(pathname)

if __name__ == '__main__':
    walk()
