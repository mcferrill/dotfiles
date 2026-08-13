#!/usr/bin/env python3

"""Normalize trailing whitespace and line endings in text files."""

import argparse
from pathlib import Path


def normalized(data: bytes) -> bytes:
    return b"".join(line.rstrip() + b"\n" for line in data.splitlines())


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="+", type=Path, help="files or glob patterns")
    parser.add_argument("--check", action="store_true", help="fail if files need changes")
    parser.add_argument("--dry-run", action="store_true", help="report changes without writing")
    args = parser.parse_args()

    files = []
    for path in args.paths:
        matches = sorted(path.parent.glob(path.name)) if any(char in str(path) for char in "*?[") else [path]
        files.extend(match for match in matches if match.is_file())

    changed = 0
    for path in dict.fromkeys(files):
        original = path.read_bytes()
        updated = normalized(original)
        if updated == original:
            continue
        changed += 1
        print(f"{'would normalize' if args.dry_run else 'normalize'}: {path}")
        if not args.check and not args.dry_run:
            path.write_bytes(updated)

    return 1 if args.check and changed else 0


if __name__ == "__main__":
    raise SystemExit(main())
