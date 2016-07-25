#!/usr/bin/env python

"""Push changes to multiple git repositories."""

import os
import sys

from fetchall import find_repos


def main():
    base = sys.argv[-1] if len(sys.argv) > 1 else os.curdir
    for repo in find_repos(base):
        os.chdir(repo)
        print 'Pushing %s' % os.path.basename(repo)
        try:
            os.system('git push origin --all')
            os.system('git push origin --tags')
        except KeyboardInterrupt:
            print 'Stopped by user.'
            break

if __name__ == '__main__':
    main()
