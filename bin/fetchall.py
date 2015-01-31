#!/usr/bin/env python

"""Locate and synchronize git working repositories."""

import os
import sys


def find_repos(where=os.curdir):
    """Find git repositories under a top level directory."""

    repos = []

    for dirname, dirnames, filenames in os.walk(where):
        if '.git' in dirnames:
            repos.append(os.path.abspath(dirname))
            continue

    return repos


def main():
    base = os.curdir
    if len(sys.argv) > 1:
        base = sys.argv[-1]
    for repo in find_repos(base):
        os.chdir(repo)
        print 'Updating %s' % os.path.basename(repo)
        try:
            os.system('git fetch --all')
        except KeyboardInterrupt:
            continue


if __name__ == '__main__':
    main()
