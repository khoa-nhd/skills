---
tags: [skill-creator]
max_turns: 20
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

/graph-memory save we decided to keep reminders in one JSON file instead of SQLite since it is a single-user CLI. next step is a `remindly snooze <id> --min 10` command, the snooze() helper already exists in models.py

Input files: README.md, docs/, remindly/, tests/, .claude/graph-memory.md
