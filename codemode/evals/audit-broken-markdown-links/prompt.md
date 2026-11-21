---
tags: [skill-creator]
max_turns: 25
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

go through all the markdown files in this repo and find links or images that point to local files that dont exist. ignore external urls and anything inside code blocks or inline code. write the results to broken-links.md, one per line as `source file: broken target`. dont change any of the docs

Input files: README.md, docs/
