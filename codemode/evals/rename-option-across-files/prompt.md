---
tags: [skill-creator]
max_turns: 25
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

rename the maxRetries option to retryLimit everywhere in this project, including the tests and docs. keep maxRetriesPerHost and the MAX_RETRIES env var exactly as they are. make sure the tests still pass when youre done

Input files: package.json, README.md, docs/, src/, test/
