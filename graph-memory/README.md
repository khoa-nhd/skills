# graph-memory

Per-folder project memory for Claude Code, built on [graphify](https://pypi.org/project/graphifyy/). A new chat picks up the work without re-reading the codebase or the old conversation, so it spends fewer tokens.

## How it works

Each project folder gets two stores:

| Store | Holds | Updated by |
|---|---|---|
| `graphify-out/` | A knowledge graph of the code: symbols, files, line numbers, who calls what | graphify, using a parser pass that costs no tokens |
| `.claude/graph-memory.md` | Short notes on what the code cannot tell you: work in progress, project rules, decisions, how to run and test | Claude, through `/graph-memory save` |

Three pieces tie them together:

- **A global SessionStart hook.** Every new chat gets a short note:
  - how old the graph is;
  - which files changed since it was built;
  - the hub symbols;
  - the Now, Rules and Overview sections of the notes.

  In folders without graph memory the hook prints nothing, so it costs nothing there.
- **A `## graph-memory` section in `CLAUDE.md`.** `init` writes it. It holds the everyday lookup rules, so Claude follows them without loading the whole skill.
- **This skill.** It is loaded only for commands, for saving notes, or in folders that have a graph but were never set up with `init`.

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
- registers the SessionStart hook in `~/.claude/settings.json`, after backing up the old file as `settings.json.graph-memory.bak`.

To check the install:

```bash
python D:/DangKhoa/project/skills/graph-memory/scripts/install.py --status
```

To uninstall:

```bash
python D:/DangKhoa/project/skills/graph-memory/scripts/install.py --uninstall
```

`--uninstall` removes the link and the hook. Project folders are not touched.

## Use it in a project

1. Open Claude Code in the project folder and run `/graph-memory init`.
2. From then on, every new chat in that folder uses the graph and the notes automatically.
3. Before you stop mid-task, run `/graph-memory save`. Claude also saves on its own after an important decision or a finished feature.

## Commands

| Command | What it does |
|---|---|
| `/graph-memory init` | Builds the graph at no token cost, installs git hooks that refresh it after commit, checkout, merge and rebase, writes the rules into `CLAUDE.md`, creates the notes file, sets `query_budget=1000` in `.graphifyrc`, and keeps `.claude/` and `CLAUDE.md` out of the graph |
| `/graph-memory update` | Refreshes the graph after code changes at no token cost. `--force` is for when code was deleted or moved. `--docs` runs semantic extraction of docs, which costs tokens, so Claude asks first |
| `/graph-memory status` | Shows graph age, changed files, the notes and the hooks. `--benchmark` estimates tokens saved per query |
| `/graph-memory ask <question>` | Answers from the graph and cites `file:line` |
| `/graph-memory impact <symbol>` | Lists what a change to that symbol would touch |
| `/graph-memory save [note]` | Updates the notes file |
| `/graph-memory resume` | Reloads the session-start note, for example after `/clear` |
| `/graph-memory remove` | Removes setup from the project but keeps the graph and notes. `--purge --yes` deletes those as well, and Claude always asks first |
| `/graph-memory help` | Lists the commands |

`init` options:
- `--no-git-hooks` skips the git hooks.
- `--guard` adds graphify's own read guard. It enforces graph-first lookups more strictly, but adds about 1–2 seconds to every file read or search on Windows, so it is off by default.

## Lookup rules Claude follows

Claude climbs these steps in order and stops as soon as it has enough:

1. **What is already in context:** the session-start note and the notes file.
2. **The graph:**
   - `graphify explain "<Symbol>"` costs a few hundred tokens and is the first choice when the name is known;
   - `graphify affected "<Symbol>"` runs before changing a signature or a shared type;
   - `graphify path "<A>" "<B>"` shows how two parts connect;
   - `graphify query "<names>" --depth 1` is for when the name is not known yet.
3. **Only the lines the graph points to**, not whole files.
4. **Grep** for literal text such as error messages or config keys.
5. **Broad reads**, only when really needed.

**The graph is enough** for questions about location or structure (where is it, what calls it), as long as no code is changed based on the answer.

**Claude must read the real code when:**
- it is about to edit that code;
- the logic, a bug or a data shape matters;
- the graph edge it relies on is `INFERRED` or `AMBIGUOUS`;
- the file changed after the last build;
- the graph came back thin or contradicts what Claude already saw;
- a signature is changing, in which case it reads every call site.

When unsure, Claude asks itself: "If this is wrong, will I write incorrect code?" If yes, it reads the code.

## Layout

```
graph-memory/
├── SKILL.md                     instructions for Claude (commands + lookup rules)
├── README.md                    this file
├── references/
│   ├── init.md                  init and remove procedures
│   └── notes.md                 notes format and save procedure
├── assets/
│   ├── claude-md-section.md     the section written into CLAUDE.md
│   └── notes-template.md        template for the notes file
├── scripts/
│   ├── gm.py                    per-project helper: init, update, status, nodes, session-start, remove
│   └── install.py               machine-wide install and uninstall
└── evals/                       3 test cases (init, feature work, save then resume)
```

`gm.py` uses only the Python standard library. You can run it by hand:

```bash
python ~/.claude/skills/graph-memory/scripts/gm.py status
```

## Running the tests

The three cases in `evals/` use the `claude plugin eval` format. Each case runs with and without the skill, and the runs are billed. From the skill folder:

```bash
claude plugin eval . --allow-tools Write,Edit,Bash --scaffold
```

## Notes

- Small projects (a few dozen files) gain little, because reading files directly is already cheap. Medium and large projects save more. Check yours with `/graph-memory status --benchmark`.
- `graphify-out/` is not added to `.gitignore` automatically. `init` reminds you so you can decide.
- The notes are written in terse English to save tokens. Names and UI strings are kept as they are.
- Never put API keys, passwords or personal data in the notes.
