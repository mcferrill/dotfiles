#!/usr/bin/env python3

"""Remove common editor and Python cache files from a directory tree."""

import argparse
import shutil
from pathlib import Path

FILE_ENDINGS = ("~", "#", ".pyc", ".DS_Store", "._.DS_Store")
SKIP_DIRS = {".git", ".venv", "node_modules"}


def candidates(root: Path):
    for path in root.rglob("*"):
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.is_dir() and path.name == "__pycache__":
            yield path
        elif path.is_file() and path.name.endswith(FILE_ENDINGS):
            yield path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", nargs="?", default=".", type=Path)
    parser.add_argument("--dry-run", action="store_true", help="list files without deleting them")
    args = parser.parse_args()

    root = args.directory.resolve()
    if not root.is_dir():
        parser.error(f"not a directory: {args.directory}")

    for path in candidates(root):
        print(f"{'would remove' if args.dry_run else 'remove'}: {path.relative_to(root)}")
        if not args.dry_run:
            if path.is_dir():
                shutil.rmtree(path)
            else:
                path.unlink()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
