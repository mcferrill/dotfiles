#!/usr/bin/env python3

'''usage: install.py [options]

Options:
    -q, --quiet          Show no output.
    -v, --verbose        Show output from subcommands.
    -u, --update         Pull updates for submodules.
    -f, --force          Force overwrite of existing files (no backup).
    -ns, --no-system     Skip system (apt/brew/yum) updates.
    -nd, --no-download   Skip any network-dependent steps.
    -np, --no-pip        Skip python modules.
'''

from glob import glob
from os.path import dirname, abspath, basename, join
import os
import subprocess
import sys

from docopt import docopt

# Constants
home = os.environ.get('HOME', os.environ.get('USERPROFILE'))
cur = dirname(abspath(__file__))
repo = join(home, '.files')
backup_dir = join(home, 'dotfiles.old')


class DotfilesInstaller:

    def symlink(self, source, target):
        """Create a symlink "target" for "source" without deleting old files.
        """

        if os.path.exists(target) or os.path.islink(target):
            if not self.args['--force']:
                if not os.path.exists(backup_dir):
                    os.makedirs(backup_dir)
                if self.args['--verbose']:
                    print('Backing up old %s' % basename(target))
                os.rename(target, join(backup_dir, basename(target)))
            else:
                os.remove(target)

        if self.args['--verbose']:
            print('Linking %s to %s' % (target, source))
        if sys.platform == 'win32':
            junction = join(repo, 'bin', 'junction.exe')
            os.system('{} {} {}'.format(junction, target, source))
        else:
            os.system('ln -s "%s" "%s"' % (source, target))

    def run(self, cmd):
        """Run a system command with verbosity based on args."""

        if isinstance(cmd, str):
            cmd = cmd.split()

        if not self.args['--verbose']:
            return subprocess.run(
                cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        else:
            return subprocess.run(cmd)

    def main(self):
        """Pull latest from github and symlink everything. Optionally backs up any
        overwritten config files.
        """

        # Parse commandline args
        self.args = docopt(__doc__)

        # Pull core and submmodule updates from github
        if not self.args['--no-download']:
            if not self.args['--quiet']:
                print('Downloading latest version from github')
            os.chdir(cur)
            self.run(['git', 'fetch', 'origin'])
            self.run(['git', 'merge', 'origin/master'])
            self.run(['git', 'submodule', 'init'])
            self.run(['git', 'submodule', 'update'])

            if not self.args['--no-pip']:
                if not self.args['--quiet']:
                    print('Installing python modules')
                self.run([
                    'python3', '-m', 'pip',
                    'install', '-r', 'requirements.txt'])

        # Update submodules
        if self.args['--update']:
            if not self.args['--quiet']:
                print('Updating submodules')
            self.run([
                'git', 'submodule', 'foreach',
                'git', 'pull', 'origin', 'master'])

        # Install to REPO
        if not self.args['--quiet']:
            print('Installing to {}'.format(repo))
        os.chdir(home)
        if repo != cur:
            os.rename(cur, repo)

        # Run system updates
        if not self.args['--no-system'] and not self.args['--no-download']:
            if not self.args['--quiet']:
                print('Installing system updates')
            if sys.platform == 'darwin':
                self.run('brew update && brew upgrade')

            elif sys.platform.startswith('linux'):
                if self.run('which apt').returncode == 0:
                    # Run without sudo if fails (for termux benefit)
                    if self.run('which sudo').returncode:
                        self.run('apt update && apt upgrade -y')
                        self.run('apt autoremove -y && apt autoclean')
                    else:
                        self.run('sudo apt update && sudo apt upgrade -y')
                        self.run(
                            'sudo apt autoremove -y && sudo apt autoclean')

        # Windows (not recently tested)
        if sys.platform == 'win32':
            if not self.args['-q']:
                print('Please add {} to your windows path'.format(
                    join(repo, 'bin')))

        # Unix-based
        else:

            # Link all the dotfiles into the home directory.
            if not self.args['--quiet']:
                print('Installing dotfiles')
            for config in glob(join(repo, 'dot', '*')):
                self.symlink(config, join(home, '.' + basename(config)))

        # Check pip for outdated packages
        if not self.args['--quiet']:
            print('Checking pip for outdated packages')
            os.system('python3 -m pip list --outdated')

        if not self.args['--quiet']:
            print('Installation complete!')


if __name__ == '__main__':
    DotfilesInstaller().main()
