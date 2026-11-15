#!/usr/bin/env bash
set -eu
cp -R "$(dirname "$0")/files/." .
python ~/.claude/skills/graph-memory/scripts/gm.py init --no-git-hooks > /dev/null
