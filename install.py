#!/usr/bin/env python3

'''usage: install.py [options]

Options:
    -q, --quiet          Show no output.
    -v, --verbose        Show output from subcommands.
    -u, --update         Pull updates for submodules.
    -f, --force          Force overwrite of existing files (no backup).
    -ns, --no-system     Skip system (apt/brew) updates.
    -nd, --no-download   Skip any network-dependent steps.
    -np, --no-pip        Skip python modules.
'''

from glob import glob
from os.path import dirname, abspath, basename, join
import psutil
import os
import subprocess
import sys

from docopt import docopt

# Constants
HOME = os.environ.get('HOME', os.environ.get('USERPROFILE'))
CURDIR = dirname(abspath(__file__))
REPO = join(HOME, '.files')
BACKUP_DIR = join(HOME, 'dotfiles.old')
POWERSHELL = psutil.Process(os.getppid()).name() == 'powershell.exe'


class DotfilesInstaller:

    def symlink(self, source, target):
        """Create a symlink "target" for "source" without deleting old files.
        """

        if os.path.islink(target) and os.path.realpath(target) == source:
            return

        if os.path.exists(target) or os.path.islink(target):
            if not self.args['--force']:
                if not os.path.exists(BACKUP_DIR):
                    os.makedirs(BACKUP_DIR)
                if self.args['--verbose']:
                    print('Backing up old %s' % basename(target))
                os.rename(target, join(BACKUP_DIR, basename(target)))
            else:
                os.remove(target)

        if self.args['--verbose']:
            print('Linking %s to %s' % (target, source))
        if sys.platform == 'win32':
            cmd = 'mklink'
            if POWERSHELL:
                cmd = f'cmd /c {cmd}'
            if os.path.isdir(source):
                cmd += ' /d'
            os.system(f'{cmd} {target} {source}')
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

    def download_updates(self):
        """Pull git updates and ensure pip packages were installed."""

        if not self.args['--quiet']:
            print('Downloading latest version from github')
        self.run(['git', 'fetch', 'origin'])
        self.run(['git', 'merge', 'origin/master'])
        self.run(['git', 'submodule', 'init'])
        self.run(['git', 'submodule', 'update'])

    def update_submodules(self):
        """Install latest master branch of each submodule."""

        if not self.args['--quiet']:
            print('Updating submodules')
        self.run([
            'git', 'submodule', 'foreach',
            'git', 'pull', 'origin', 'master'])

    def install_system_updates(self):
        """Run system specific updates (scoop, homebrew, apt, etc)."""

        if not self.args['--quiet']:
            print('Installing system updates')

        if sys.platform == 'darwin':
            self.run('brew update && brew upgrade')

        elif sys.platform == 'win32':
            self.run('scoop update')

        elif sys.platform.startswith('linux'):
            # Debian based systems (apt)
            if self.run('which apt').returncode == 0:
                # Run without sudo if fails (for termux benefit)
                if self.run('which sudo').returncode:
                    self.run('apt update && apt upgrade -y')
                    self.run('apt autoremove -y && apt autoclean')
                else:
                    self.run('sudo apt update && sudo apt upgrade -y')
                    self.run(
                        'sudo apt autoremove -y && sudo apt autoclean')

    def install_windows(self):
        """Install dotfiles to windows-specific paths."""

        # .config
        for fname in os.listdir(join(REPO, 'dot', 'config')):
            self.symlink(join(REPO, 'dot', 'config', fname),
                         join(HOME, '.config', fname))

        # pip
        self.symlink(join(REPO, 'dot', 'pip'), join(HOME, 'pip'))

        # Simple symlinks
        for path in ('poshthemes',):
            self.symlink(join(REPO, 'dot', path), join(HOME, '.' + path))

        # vim
        self.symlink(join(REPO, 'dot', 'vimrc'), join(HOME, '_vimrc'))
        self.symlink(join(REPO, 'dot', 'vim'), join(HOME, 'vimfiles'))

        # neovim
        self.symlink(join(REPO, 'dot', 'vim'),
                     join(HOME, 'AppData', 'Local', 'nvim'))
        self.symlink(join(REPO, 'dot', 'vimrc'),
                     join(HOME, 'AppData', 'Local', 'nvim', 'init.vim'))

    def main(self):
        """Pull latest from github and symlink everything. Optionally backs up
        any overwritten config files.
        """

        self.args = docopt(__doc__)
        os.chdir(CURDIR)

        if not self.args['--no-download']:
            self.download_updates()

        # Install pip dependencies
        if not self.args['--no-pip']:
            if not self.args['--quiet']:
                print('Installing python modules')
            self.run([
                'python3', '-m', 'pip',
                'install', '-r', 'requirements.txt'])
            self.run(['pipx', 'ensurepath'])

        if self.args['--update']:
            self.update_submodules()

        # Install to REPO
        if sys.platform == 'win32':
            if not self.args['--quiet']:
                print(f'Note that dotfiles will remain at {CURDIR}')
        else:
            if not self.args['--quiet']:
                print(f'Installing to {REPO}')
            os.chdir(HOME)
            if REPO != CURDIR:
                os.rename(CURDIR, REPO)

        if not self.args['--no-system'] and not self.args['--no-download']:
            self.install_system_updates()

        if sys.platform == 'win32':
            if not self.args['--quiet']:
                print('Make sure {} is in your path'.format(
                    join(CURDIR, 'bin')))

        # Link all the dotfiles into the home directory.
        if not self.args['--quiet']:
            print('Installing dotfiles')
        if not os.path.exists(join(HOME, '.config')):
            os.mkdir(join(HOME, '.config'))
        if sys.platform == 'win32':
            self.install_windows()
        else:
            for config in glob(join(REPO, 'dot', '*')):
                if os.path.split(config)[-1] == 'config':
                    for sub in glob(join(REPO, 'dot', 'config', '*')):
                        self.symlink(config,
                                     join(HOME, 'config', basename(sub)))
                else:
                    self.symlink(config, join(HOME, '.' + basename(config)))

        if not self.args['--quiet']:
            print('Installation complete!')


if __name__ == '__main__':
    DotfilesInstaller().main()
