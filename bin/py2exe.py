'''
Py2Exe simplification utility. Creates minimum-sized windows executable
from a python script.
'''

import os, shutil, sys, subprocess

#Be sure that py2exe is installed on this machine
try:
    import py2exe
except ImportError:
    print 'py2exe is not installed on this computer. Please download and install it before using this utility.'
    sys.exit(0)

def make_exe(source, packages=(), data_dir='', windows=False):
    '''
    Quickly makes a basic .exe file from a python script with a compact dist.
    '''

    #verify paramaters
    try:
        source = os.path.join(os.curdir, source)
        open(source).close()
    except:
        print '%s not found!' % source
        sys.exit(0)

    for pack in packages:
        try:
            exec(compile('import %s', 'temp', 'exec'))
        except ImportError:
            print 'Package or module %s not found!' % pack
            sys.exit(0)

    if data_dir:
        data_dir = os.path.join(os.path.split(source)[0],
                                data_dir)
        try:
            old_dir = os.curdir
            os.chdir(data_dir)
            os.chdir(old_dir)
        except:
            print 'Directory %s does not exist!' % data_dir
            sys.exit(0)

    #create and execute setup script

    if windows:
        mode = 'windows'
    else:
        mode = 'console'
    
    setup_script = os.path.join(os.environ['TMP'], 'setup.py')
    f = open(setup_script, 'w')
    f.write('''from distutils.core import setup

import py2exe
setup(%s=["%s"], zipfile=None)''' % (mode, source))
    f.close()
    cmd = '%s %s py2exe --dist-dir=%s -b 1 ' % (
        sys.executable,
        setup_script,
        os.path.join(
            os.path.abspath(os.curdir),
            os.path.splitext(os.path.split(source)[1])[0].capitalize())
        )
    if len(packages):
        cmd += '-i '+' '.join(packages)
    print cmd

    print 'Creating executable...'
    os.system(cmd)
    print 'done'

    if data_dir:
        print 'Copying data files...'
        shutil.copytree(data_dir, os.path.join(os.curdir,
                                               os.path.split(data_dir)[1]))
        print 'done'

if __name__=='__main__':
    import optparse
    parser = optparse.OptionParser(usage='usage: %prog [options]')
    parser.add_option(
        '-w',
        '--windowed',
        dest='windowed',
        help='windowed flag',
        action='store_true',
        default=False
        )
    parser.add_option(
        '-d',
        '--data-dir',
        type='string',
        dest='data_dir',
        help='path to data directory (relative to the source)',
        default=''
        )
    parser.add_option(
        '-i',
        '--include',
        type='string',
        dest='packages',
        nargs=-1, #unlimited
        help='space-seperated list of packages or modules to include',
        default=()
        )
    parser.add_option(
        '-s',
        '--source',
        type='string',
        dest='source',
        help='path to source file to use, if no other options are used simply use the path'
        )

    options, args = parser.parse_args()

    if len(args) == 1:
        make_exe(args[0])
    elif options.source == None:
        print 'No source file supplied!'
    else:
        make_exe(
            options.source,
            options.packages,
            options.data_dir,
            options.windowed
            )
