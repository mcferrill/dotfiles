#!/usr/bin/env python

"""Walk a directory structure and get a count of files and directories."""

from __future__ import print_function

import os

if __name__ == '__main__':
    files = []
    directories = []
    for dirname, dirnames, filenames in os.walk(os.curdir):
        for dirname in dirnames:
            directories.append(dirname)
        for filename in filenames:
            files.append(filename)

    print('%s directories and %s files' % (len(directories), len(files)))
