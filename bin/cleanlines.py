#!/usr/bin/env python

"""Strips excess whitespace off the end of lines of code and replaces lineendings with "\n"."""

import glob
import sys

if __name__ == "__main__":
    for filename in glob.glob(sys.argv[1]):
        src = b""
        with open(filename, "rb") as f:
            src = f.read()
        with open(filename, "wb") as f:
            for line in src.splitlines():
                f.write(line.rstrip() + b"\n")
