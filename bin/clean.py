#!/usr/bin/env python

import os, sys

def walk(dirname=os.curdir):
    for basename in os.listdir(dirname):
        pathname = dirname + '/' + basename
        if os.path.isdir(pathname) and '-r' in sys.argv:
            walk(pathname)
        else:
            if basename.endswith('~') or (basename.startswith('#') and basename.endswith('#')) or basename.endswith('.pyc'):
                os.remove(pathname)

if __name__=='__main__':
    walk()
