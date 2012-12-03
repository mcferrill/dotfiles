#!/usr/bin/env python

import glob
import sys

if __name__ == '__main__':
    for filename in glob.glob(sys.argv[1]):
        f = open(filename, 'rb')
        src = f.read()
        f.close()
        f = open(filename, 'wb')
        for line in src.splitlines():
            f.write(line.rstrip() + '\n')
        f.close()
