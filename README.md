# skills

My personal collection of skills for [Claude Code](https://claude.com/claude-code). Each folder is one skill: a `SKILL.md` with instructions for Claude, plus any scripts, references and tests it needs.

## Skills

| Skill | What it does |
|---|---|
| [graph-memory](graph-memory/) | Per-folder project memory built on graphify: a code knowledge graph plus a short notes file. `/graph-memory use <task>` codes graph-first: it checks the context is complete before editing and verifies with a build or tests. Saves tokens without hurting code quality, and new chats continue the work without re-reading the codebase. Other commands: `init`, `update`, `status`, `ask`, `impact`, `save`, `resume`, `remove`. |
| [codemode](codemode/) | Batches predictable multi-file work into one JavaScript script with undo, permission-aware guardrails, and a compact report. Works anywhere Claude Code has Bash, including the Desktop app. |

## Using a skill

Claude Code loads skills from `~/.claude/skills/<name>/`. To use one from this repo, link or copy its folder there. Some skills ship their own installer; graph-memory does:

```bash
python graph-memory/scripts/install.py
```

Each skill's own README has the details.
