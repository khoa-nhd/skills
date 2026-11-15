---
name: graph-memory
description: Per-folder project memory for Claude Code built on graphify (a code knowledge graph plus a short notes file), so a new chat continues the work without re-reading the codebase or the old conversation. Commands - /graph-memory init (set up memory in the current folder and build the graph), update, status, ask, impact, save, resume, remove. Use this skill whenever the user wants Claude to remember a project between chats, save progress or decisions, pick up where the last session stopped, spend fewer tokens while coding, or set up or refresh a graphify graph; also for code lookups in a folder that has graphify-out/ but whose CLAUDE.md has no graph-memory section.
argument-hint: "init | update [--force|--docs] | status | ask <question> | impact <symbol> | save [note] | resume | remove | help"
---

# Graph memory

Each project folder gets two stores:

- `graphify-out/`: graphify's knowledge graph of the code (symbols, files, line numbers, who calls what). graphify builds and refreshes it with a parser pass that costs no tokens.
- `.claude/graph-memory.md`: a short notes file for what the code cannot tell you: work in progress, project rules, decisions, how to run things.

A global SessionStart hook gives every new chat a compact note: graph freshness, files changed since the last build, hub symbols, and the hot sections of the notes. In folders without graph memory it prints nothing, so it costs nothing there. In a set-up folder, CLAUDE.md carries a short `## graph-memory` section with the everyday rules, so this skill only needs loading for commands, saves, or folders that were never set up.

Why it matters: the graph is a map. It says where things are and how they connect, for a few hundred tokens. It does not say what the code does line by line. Most of this skill is about using the map to go straight to the right few lines, and noticing when the map is not enough.

`scripts/gm.py` does the deterministic work (finding the project root, freshness checks, writing setup files) so you do not spend tokens doing it by hand. Run it as `python ~/.claude/skills/graph-memory/scripts/gm.py <subcommand>` (the global install links this skill there).

## Commands

The first word of the user's argument picks the command. With no argument, run `status` and list the commands.

| Command | What to do |
|---|---|
| `init` | Set up graph memory in the current folder. Follow `references/init.md`. |
| `update` | Run `gm.py update` (parser refresh, no tokens). Add `--force` when code was deleted or moved and graphify refuses to shrink the graph. `update --docs` means semantic extraction of docs, papers and images: invoke the graphify skill with `. --update`. That costs real tokens, so say so and get a yes first. |
| `status` | Run `gm.py status` and relay it in a few lines. `status --benchmark` adds graphify's estimate of tokens saved per query. |
| `ask <question>` | Answer from the graph with the lookup ladder below. Cite `file:line`, and say what you could not confirm without reading code. |
| `impact <symbol>` | Run `graphify affected "<symbol>"` and `graphify explain "<symbol>"`. List what a change would touch, grouped by file. Read nothing more unless asked to make the change. |
| `save [note]` | Update the notes file. Follow `references/notes.md`. |
| `resume` | Run `gm.py session-start --plain`, then wait for the task. Read nothing else until the task needs it. |
| `remove` | Undo init in this folder. Follow the Remove section of `references/init.md`. Confirm with the user first. |
| `help` | List these commands, one line each. |

## Everyday lookups

These rules apply in any folder with `graphify-out/graph.json`, with or without a command. Run graphify from the project root; the session note names the root when the chat starts in a subfolder. Call the graphify CLI directly. The graphify skill itself is long and is only needed for semantic doc builds.

### The ladder

Climb only as far as the task needs. Each rung costs more than the one before.

1. **What is already in context.** The session note and the notes file often answer "how do I run this", "what were we doing" or "what is the convention". Use them before searching.
2. **The graph.** Pick the narrowest command:
   - `graphify explain "<Symbol>"`: one symbol's file and line, plus its most-connected neighbours with `file:line` and edge confidence. Usually a few hundred tokens. Use this first whenever you know a name.
   - `graphify affected "<Symbol>"`: everything that depends on it (callers, importers, users). Use before changing a signature, a type or a shared helper.
   - `graphify path "<A>" "<B>"`: how two parts connect.
   - `graphify query "<identifiers>" --depth 1`: discovery when you do not know the names yet. Init sets the answer cap to 1000 tokens. Raise it with `--budget` only if the cut part matters.
   - Matching is literal on node labels, with no synonyms and no translation. Use names as written in the code (`ReminderStore`, `parse_delay`), not descriptions ("the class that stores reminders"). Exit code 3 means the name is ambiguous, so pick from the listed candidates. Exit code 4 means no match: run `gm.py nodes <word> [word...]` to find close labels. After two misses, move on to grep.
3. **Targeted read.** Graph output carries `file:Lnn`. Read that range with offset and limit: the symbol plus enough context to see where it starts and ends. Do not read the whole file.
4. **Grep.** For literal text the graph does not model (error messages, config keys, CSS classes, SQL, route strings), or when the graph has no node. Scope it to the paths the graph pointed to.
5. **Broad read.** Whole files or folders only when you really need them: rewriting a file, a file so short that a targeted read saves nothing, or an area the graph covers poorly (a language graphify did not parse, generated code).

### When the graph is enough

If the question is about location or structure, and you will not change code based on the answer, stop at the graph. That covers: which file or symbol implements X, what calls X, what X uses, which files a change touches, how two areas connect, and which files to open next. Once you can name the file, the symbol and its callers or callees, stop querying.

### When to read the real code

Read the actual lines whenever one of these holds. Skipping them is how token savings turn into wrong code, which costs far more to fix than the read would have.

- **You are going to edit it.** Read the region you will change, plus enough around it to match style and imports. Never write an edit from graph output alone.
- **Behaviour matters**: conditions, error handling, data shapes, return values, side effects, the cause of a bug.
- **The edge you rely on is `INFERRED` or `AMBIGUOUS`.** Only `EXTRACTED` edges come straight from the parser.
- **The file changed after the last build.** The session note lists such files, and anything you edited this session counts too. Either run `graphify update .` first, or treat the graph data for that file as a hint.
- **The graph came back thin, or contradicts what you already saw.**
- **You are changing a signature, a shared type or a hub.** Use `affected` to list dependents, then read each call site you will update. For hubs, also grep for code that does the hub's job without calling it, because the graph cannot see that.

When unsure, ask: "If this is wrong, will I write incorrect code?" If yes, read. If it would only make an explanation a little less precise, the graph is enough.

### Not wasting what you already have

- Do not re-run a query or re-read a range that is already in context.
- Do not search for something the notes or this session already told you.
- Prefer one `explain` over several broad `query` calls.
- When you hand exploration to a subagent, include these rules in its prompt. Subagents do not get the session note.

### After editing code

After a batch of edits (not after each one), run `graphify update .` so later lookups see the new code. It is a parser pass with no token cost. If graphify's git hooks are installed, commits also refresh the graph in the background.

## Project notes

The notes file holds what the graph cannot. Its Now, Rules and Overview sections reach every new chat through the session note, so keep it small and current. Update it at natural checkpoints, and say so in one line when you do:

- a decision was made;
- the user stated a rule or preference for this project;
- a feature was finished;
- the user is wrapping up with work still in progress.

The user can also run `/graph-memory save` at any time. Format and procedure: `references/notes.md`.
