#!/usr/bin/env python

"""Locate and synchronize git working repositories."""

import os
import sys


def find_repos(where=os.curdir):
    """Find git repositories under a top level directory."""

    for dirname, dirnames, filenames in os.walk(where):
        if '.git' in dirnames:
            yield os.path.abspath(dirname)


def main():
    base = sys.argv[-1] if len(sys.argv) > 1 else os.curdir
    for repo in find_repos(base):
        os.chdir(repo)
        print 'Updating %s' % os.path.basename(repo)
        try:
            os.system('git fetch --all')
        except KeyboardInterrupt:
            print 'Stopped by user.'
            break

if __name__ == '__main__':
    main()
