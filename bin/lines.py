#!/usr/bin/env python

"""Walk a directory structure and count lines of code."""

import glob
import os

types = ['.py', '.js', '.html', '.haml', '.sass', '.css', '.cgi']
exceptions = ('ckeditor',)


def crawl(path=os.curdir):
    lines = 0
    chars = 0
    files = []
    for type in types:
        files += glob.glob(path + '/*' + type)
    for obj in files:
        exception = False
        for exc in exceptions:
            if exc in obj:
                exception = True
                continue
        if exception:
            continue
        f = open(obj)
        s = f.read()
        lines += len([l for l in s.splitlines() if l.strip()])
        chars += len(s)
        f.close()
    for obj in glob.glob(path + '/*'):
        if os.path.isdir(obj):
            result = crawl(obj)
            lines += result[0]
            chars += result[1]
    return lines, chars

if __name__ == '__main__':
    lines, chars = crawl()
    print 'There are %s lines and %s characters in this and nested \
directories.' % (lines, chars)
