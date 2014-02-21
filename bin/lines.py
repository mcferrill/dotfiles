#!/usr/bin/env python

"""Walk a directory structure and count lines of code."""

from itertools import chain
from glob import glob
import sys
import os

types = ['.py', '.js', '.html', '.haml', '.sass', '.css', '.cgi']
exceptions = ('ckeditor',)


def crawl(path=os.curdir):
    lines, chars = 0, 0
    files = chain(*[glob(path + '/*' + type) for type in types])
    for obj in files:
        exception = False
        for exc in exceptions:
            if exc in obj:
                exception = True
                continue
        if exception:
            continue
        with open(obj) as f:
            s = f.read()
        lines += len([l for l in s.splitlines() if l.strip()])
        chars += len(s)
    for obj in glob(path + '/*'):
        if os.path.isdir(obj):
            result = crawl(obj)
            lines += result[0]
            chars += result[1]
    return lines, chars

if __name__ == '__main__':
    if len(sys.argv) > 1:
        types = sys.argv[1:]
    lines, chars = crawl()
    print 'There are %s lines and %s characters in this and nested \
directories.' % (lines, chars)
