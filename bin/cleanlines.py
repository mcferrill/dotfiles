#!/usr/bin/env python

"""Strips excess whitespace off the end of lines of code."""

import glob
import sys

if __name__ == '__main__':
    for filename in glob.glob(sys.argv[1]):
        with open(filename, 'rb') as f:
            src = f.read()
        # @todo: replace line endings with unix-style?
        with open(filename, 'wb') as f:
            for line in src.splitlines():
                f.write(line.rstrip() + '\n')
