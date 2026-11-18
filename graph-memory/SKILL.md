---
name: graph-memory
description: Per-folder project memory on graphify - a code graph plus short notes. /graph-memory use <task> codes graph-first with a context check and build/test verification; also init, save, resume, status, update, ask, impact, remove. Use for /graph-memory, project memory across chats, saving or resuming progress, or setting up or refreshing a graphify graph.
argument-hint: "use <task> | init | update | status | ask <question> | impact <symbol> | save [note] | resume | remove | help"
---

# Graph memory

- `gm.py` means `python $HOME/.claude/skills/graph-memory/scripts/gm.py`.
- The graph is in `graphify-out/` and the notes are in `.claude/graph-memory.md`.
- A Stop hook refreshes the graph after each reply.
- Never load the graphify skill except for `update --docs`.

## /graph-memory use <task>

Do the task, and the later tasks in this chat, by the `## graph-memory` rules in this folder's CLAUDE.md. Those rules are the whole procedure: locate, context line, read, edit, verify, report.

If CLAUDE.md has no such section, read `assets/claude-md-section.md` from this skill once and follow it, then offer `init`.

## Other commands

With no argument, run `status` and list the commands.

| Command | What to do |
|---|---|
| `init`, `remove` | Follow `references/init.md`. Confirm `remove` with the user first. |
| `update` | Run `gm.py update` (no tokens; add `--force` after deleting or moving code). `--docs` runs the graphify skill with `. --update`, which costs tokens, so ask first. |
| `status` | Run `gm.py status` (`--benchmark` adds an estimate) and relay it briefly. |
| `ask <question>` | Use the CLAUDE.md lookups and cite `file:line`. Read the code when the answer depends on behaviour (conditions, errors, data shapes). Say what is unconfirmed. |
| `impact <symbol>` | Run `graphify affected` (default depth 2, for indirect reach) and `graphify explain`, then list what a change would touch, by file. |
| `save [note]` | Follow `references/notes.md`. |
| `resume` | Run `gm.py session-start --plain`, then wait for the task. |
| `help` | List the commands, one line each. |

The notes format and the save procedure are in `references/notes.md`. Lookup corner cases (exit codes, coverage, Android and DI, test failures) are in `references/lookup.md`.
