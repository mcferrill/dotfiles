#!/usr/bin/env python

"""Remove common cached files (.pyc, <name>~, #<name>#, etc.)."""

import os
import shutil

FILE_ENDINGS = (
    '~',
    '#',
    '.pyc',
    '.DS_Store',
    '._.DS_Store',
)


if __name__ == '__main__':
    for dirpath, dirnames, filenames in os.walk(os.curdir):
        for dirname in dirnames:
            if dirname.endswith('__pycache__'):
                shutil.rmtree(os.path.join(dirpath, dirname), True)
        
        for name in filenames:
            for ending in FILE_ENDINGS:
                if name.endswith(ending):
                    os.remove(os.path.join(dirname, name))
                    break
