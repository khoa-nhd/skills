# graph-memory

Per-folder project memory for Claude Code, built on [graphify](https://pypi.org/project/graphifyy/). Claude spends tokens only on the code that matters, without trading away correctness, and a new chat picks up the work without re-reading the codebase or the old conversation.

## How it works

Each project folder gets two stores:

| Store | Holds | Updated by |
|---|---|---|
| `graphify-out/` | A knowledge graph of the code: symbols, files, line numbers, who calls what | graphify, using a parser pass that costs no tokens |
| `.claude/graph-memory.md` | Short notes on what the code cannot tell you: work in progress, project rules, decisions, how to build and test | Claude, through `/graph-memory save` and at checkpoints |

These pieces tie the stores together:

- **`/graph-memory use <task>`.** The main command. Claude does the task graph-first:
  1. locates code with the graph;
  2. writes a one-line context check of what it has, what it still reads and why;
  3. edits, updating every call site when a contract changes;
  4. verifies with a build or tests;
  5. refreshes the graph and the notes.
- **A global SessionStart hook.** Every new chat gets a short note:
  - how old the graph is;
  - which files changed since it was built;
  - the hub symbols;
  - the Now, Rules and Overview sections of the notes.

  It also brings the project's CLAUDE.md section up to the installed skill version.
- **A global Stop hook.** After each reply, if code changed since the last build, it refreshes the graph in the background, at no token cost. This works in folders that are not git repos too.
- **A `## graph-memory` section in `CLAUDE.md`.** `init` writes it. It holds the everyday rules, so Claude follows them even without typing `use`.

Both hooks do nothing in folders without graph memory, so they cost nothing there.

## Install (once per machine)

You need Python 3.10+ and the graphify CLI:

```bash
pip install graphifyy
```

Then run the installer:

```bash
python D:/DangKhoa/project/skills/graph-memory/scripts/install.py
```

The installer does two things:
- links `~/.claude/skills/graph-memory` to this folder, so edits here apply to every chat;
- registers both hooks in `~/.claude/settings.json`, after backing up the old file as `settings.json.graph-memory.bak`.

To check the install:

```bash
python D:/DangKhoa/project/skills/graph-memory/scripts/install.py --status
```

To uninstall:

```bash
python D:/DangKhoa/project/skills/graph-memory/scripts/install.py --uninstall
```

`--uninstall` removes the link and the hooks. Project folders are not touched.

## Use it in a project

1. Open Claude Code in the project folder and run `/graph-memory init`.
2. Give coding tasks as `/graph-memory use <what you want>`. For example: `/graph-memory use add a snooze button to the reminder overlay`. Claude keeps working that way for the rest of the chat, and you can type `use` again whenever you like.
3. Before you stop mid-task, run `/graph-memory save`. Claude also saves on its own after an important decision or a finished feature.

## Commands

| Command | What it does |
|---|---|
| `/graph-memory use <task>` | Does the task: graph lookup, context check, edit, build or test, graph refresh, short report |
| `/graph-memory init` | Builds the graph at no token cost, installs git hooks in git repos, writes the rules into `CLAUDE.md`, creates the notes file, sets `query_budget=1000` in `.graphifyrc`, and keeps `.claude/` and `CLAUDE.md` out of the graph |
| `/graph-memory update` | Refreshes the graph now (the Stop hook usually already has). `--force` is for when code was deleted or moved. `--docs` runs semantic extraction of docs, which costs tokens, so Claude asks first |
| `/graph-memory status` | Shows graph age, changed files, the last background refresh, the notes and the hooks. `--benchmark` estimates tokens saved per query |
| `/graph-memory ask <question>` | Answers from the graph and cites `file:line` |
| `/graph-memory impact <symbol>` | Lists what a change to that symbol would touch |
| `/graph-memory save [note]` | Updates the notes file |
| `/graph-memory resume` | Reloads the session-start note, for example after `/clear` |
| `/graph-memory remove` | Removes setup from the project but keeps the graph and notes; Claude shows a `--dry-run` first. `--git-hooks` and `--guard` also remove graphify's own hooks and guard. `--purge --yes` deletes the graph and notes as well, and Claude always asks first |
| `/graph-memory help` | Lists the commands |

`init` options:
- `--no-git-hooks` skips the git hooks.
- `--guard` adds graphify's own read guard. It enforces graph-first lookups more strictly, but adds about 1–2 seconds to every file read or search on Windows, so it is off by default.

## How Claude decides it has enough context

1. **Locate:** `graphify explain` for a known name (a few hundred tokens, up to 20 neighbours), `affected --depth 1` for direct dependents (the call sites to update), `path` for connections, `query --depth 1` when names are unknown.
2. **Check before the first edit.** Claude writes `Context: have ... Reading ... because ... Skipping ...` and answers each item that applies:
   - **the code it will change:** always read, never edited from graph output alone;
   - **who depends on it:** from `affected` when the contract changes, with each call site read;
   - **what it calls**, when behaviour matters;
   - **what the graph cannot see:** config, XML layouts and manifests, string resources, build scripts, SQL, string-keyed lookups, DI and reflection, all found with grep;
   - **tests** for the area;
   - **project rules** from the notes.
3. **Read real code, not just the graph,** when behaviour matters, when an edge is `INFERRED` or `AMBIGUOUS`, when the file changed since the build, or when the graph came back thin. Thin means:
   - a public symbol has no callers or only one;
   - the symbol is an Activity, Fragment, ViewModel, Service, DI-provided or XML-referenced class;
   - or the file is missing from the graph.

   In those cases Claude greps the name before trusting "no callers".
4. **Never skip the graph silently.** When Claude uses grep instead, it says why in one line. If it is unsure whether the graph covers a file, it checks with `gm.py covers <file>` (0 nodes means grep) rather than assuming.
5. **Stop reading** once every applicable item is answered. When unsure, it asks: "If this is wrong, will I write incorrect code?"
6. **Verify** with the narrowest build or test before calling the task done.

## Layout

```
graph-memory/
├── SKILL.md                     instructions for Claude (use + lookup rules + commands)
├── README.md                    this file
├── references/
│   ├── init.md                  init and remove procedures
│   └── notes.md                 notes format and save procedure
├── assets/
│   ├── claude-md-section.md     the section written into CLAUDE.md
│   └── notes-template.md        template for the notes file
├── scripts/
│   ├── gm.py                    per-project helper: init, update, status, nodes, covers, session-start,
│   │                            stop-hook, bg-update, remove
│   └── install.py               machine-wide install and uninstall
└── evals/                       test cases (init, feature work, use command, save then resume)
```

`gm.py` uses only the Python standard library. Run it by hand with `$HOME`, which works in both bash and PowerShell (`~` does not work in PowerShell):

```bash
python $HOME/.claude/skills/graph-memory/scripts/gm.py status
```

## Running the tests

The cases in `evals/` use the `claude plugin eval` format. Each case runs with and without the skill, and the runs are billed. From the skill folder:

```bash
claude plugin eval . --allow-tools Write,Edit,Bash --scaffold
```

## Notes

- Small projects (a few dozen files) gain little, because reading files directly is already cheap. Medium and large projects save more. Check yours with `/graph-memory status --benchmark`.
- `graphify-out/` is not added to `.gitignore` automatically. `init` reminds you so you can decide.
- The notes are written in terse English to save tokens. Names and UI strings are kept as they are.
- Never put API keys, passwords or personal data in the notes.
