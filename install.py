#!/usr/bin/env python

import glob
import sys
import os

def main():
    os.chdir(os.path.dirname(__file__))
    if not os.path.exists('../bin'): os.makedirs('../bin')
    if sys.platform == 'win32':
        for filename in glob.glob('bin/*.py') + glob.glob('bin/*.exe'):
            os.system('junction ../bin/%s' % os.path.basename(filename), filename)


if __name__=='__main__': main()
