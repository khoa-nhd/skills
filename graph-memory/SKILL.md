---
name: graph-memory
description: Per-folder project memory for Claude Code built on graphify (a code knowledge graph plus a short notes file), so coding spends tokens only on the code that matters and a new chat continues without re-reading the codebase. Main command - /graph-memory use <task> (do a coding task graph-first, check the context is complete before editing, verify with a build or tests). Others - init, update, status, ask, impact, save, resume, remove. Use this skill whenever the user types /graph-memory, wants Claude to remember a project between chats, save progress or decisions, pick up where the last session stopped, or spend fewer tokens while coding without hurting code quality; also to set up or refresh a graphify graph, and for code lookups in a folder that has graphify-out/ but whose CLAUDE.md has no graph-memory section.
argument-hint: "use <task> | init | update | status | ask <question> | impact <symbol> | save [note] | resume | remove | help"
---

# Graph memory

Each project folder gets two stores:
- `graphify-out/`: a knowledge graph of the code (symbols, files, line numbers, who calls what). A parser pass builds it at no token cost.
- `.claude/graph-memory.md`: short notes (work in progress, rules, decisions, how to build and test).

Global hooks keep both in play. When a chat starts, a note reports graph freshness, changed files, hub symbols and the hot sections of the notes. After each reply, changed code triggers a background graph refresh. Folders without graph memory are left alone.

The graph is a map. It says where code is and how it connects, for a few hundred tokens. It does not say what the code does line by line. Spend tokens on the few lines that matter, and read real code whenever correctness depends on it. Saving tokens never justifies a wrong edit: a bug costs far more to find and fix than the reads it saved.

Helper script: `python $HOME/.claude/skills/graph-memory/scripts/gm.py <subcommand>`, called `gm.py` below.

## /graph-memory use <task>

This is the main command. Do the task in the steps below. Keep working this way for later tasks in the same chat, whether or not the user types `use` again.

1. **Start from what you already have.** The session note and the notes file cover current work, project rules, and how to build and test. If the session note lists changed files, run `gm.py update` once before the first lookup (a few seconds, no tokens). Do not try to guess which of those files you will touch.

2. **Locate with the graph** (see Lookup rules):
   - `explain` for a name you know;
   - `affected --depth 1` for its direct dependents;
   - `path` for how two parts connect;
   - `query --depth 1` when you do not know the names yet.

3. **Check the context before the first edit.** Write one or two lines to the user in this form:
   `Context: have <what you know, and from where>. Reading <what> because <why>. Skipping <what you deliberately leave out>.`
   - Fill it in with the checklist under "Enough context?". Then read exactly what the line says is still missing, and nothing more. Writing it down stops both habits: reading everything "to be safe", and editing on a guess.
   - If a read reveals a dependency you did not list (a caller, a resource or key, shared state), add it, check it, and say so in one line.

4. **Change the code.** Read each region before you edit it.
   - If you change a contract (signature, return value, thrown errors, side effects, data shape, a shared type, a hub), run `affected --depth 1` and update or consciously clear every direct dependent.
   - Code that nothing references yet (a new standalone function, class or command) needs no `affected` run. That exemption does not cover adding a member to an interface or abstract class, a value to an enum or sealed hierarchy, a parameter (even one with a default), or an entry in XML or DI. For those, run `affected --depth 1` on the type, and grep its implementers and `when` sites.
   - When you add or change behaviour in an area that has tests, add or update a test for it.

5. **Verify.** Run the narrowest command that covers the change and everything `affected` listed. If a contract used by another module or package changed, build or test that module too.
   - The notes' Overview usually names the commands. Otherwise use the project's standard ones, for example: Gradle `./gradlew :<module>:compileDebugKotlin` and `:<module>:testDebugUnitTest` (`gradlew.bat` in cmd), `npm test`, `pytest path/to/test_x.py`, `cargo test`.
   - A slow build is not a reason to skip verifying.
   - If a test fails, first read the failure: does it touch code you changed? Use `git stash` to check the code before your change only in a git repo whose uncommitted changes are all yours, and run `git stash pop` right after. Otherwise report the failure as possibly pre-existing. Do not "fix" unrelated failures.
   - Fix your own failures before calling the task done.
   - If some path cannot run here (an entry point with real side effects, a device-only feature), name exactly what was not run.

6. **Refresh and record.** Run `gm.py update`, not `graphify update .`: gm.py records state that `status` and the hooks rely on. Later lookups in this reply need the new code in the graph. If it reports that graphify kept the old graph and you deleted or moved code in this task, run `gm.py update --force`. Then record anything worth keeping:
   - **A feature finished:** add one Log line `YYYY-MM-DD - what was done` at the top of Log (newest first; keep the last 10) and refresh Now in `.claude/graph-memory.md`.
   - **A decision or a new rule:** add it to Decisions or Rules.

   The full save procedure in `references/notes.md` is only needed for `/graph-memory save`.

7. **Report** in a few lines: what changed, what was verified and how, and what was not. Before sending, check that every "Reading" item in your context line was read, and every direct dependent was updated or cleared.

## Lookup rules

Run graphify from the project root; the session note names it when the chat starts in a subfolder. Call the graphify CLI directly for lookups (`explain`, `affected`, `path`, `query`), and refresh only through `gm.py update`. The graphify skill itself is long and only needed for semantic doc builds.

### The ladder

Climb only as far as the task needs. Each rung costs more than the one before.

1. **What is already in context**: the session note, the notes file, and earlier reads in this chat.

2. **The graph.** Pick the narrowest command:
   - `graphify explain "<Symbol>"`: file and line, plus up to 20 neighbours with `file:line` and edge confidence, in a few hundred tokens. Use it first whenever you know a name. It is not a full caller list (`--all` lists every neighbour).
   - `graphify affected "<Symbol>" --depth 1`: the direct dependents, which are the call sites you may need to edit. The default depth 2 also shows indirect reach; use it to judge impact, not as a list to read.
   - `graphify path "<A>" "<B>"`: how two parts connect.
   - `graphify query "<identifiers>" --depth 1`: discovery. Answers are capped at 1000 tokens (set by init); raise the cap with `--budget` only if the cut part matters.

   Matching is literal on node labels: no synonyms, no translation, and trailing `()` is optional. Use names as written in code (`ReminderStore`, `parse_delay`), not descriptions.
   - Exit code 3 means ambiguous. Pick the candidate whose file is in the area you are working on and use its full label.
   - For common method names (`onCreate`, `invoke`, `bind`), qualify the name with its class, as in `graphify affected "SpikePrefs.studyTime" --depth 1`. Method nodes are labelled `.name()`, and `Class.method` resolves to them. Do not run `affected` on the class when only a method's contract changes: that lists who uses the class, not who calls the method.
   - Exit code 4 means no match. Run `gm.py nodes <word> [word...]`. After two misses, move on to grep.

3. **Targeted read.** Start a few lines before the `file:Lnn` the graph gave you and read about 60 lines. If the function or class you will change continues past that, keep reading to its end; the next symbol's line from `explain` tells you where to stop. Never edit a region you have only partly read. A file under about 80 lines can be read whole, since a targeted read would save nothing.

4. **Grep** for literal text the graph does not model.
   - **Check before assuming.** What graphify extracts varies by language and project. When you are not sure the graph covers what you need, check cheaply:
     - `gm.py nodes <name>` for a symbol;
     - `gm.py covers <file>...` for files: 0 nodes means the graph knows nothing about their contents.
   - **Say why in one line** whenever you go to grep instead of the graph, for example: `Lookup: grep, because covers shows 0 nodes for the SQL migration and vi.json`. It tells the user the skip was deliberate, not forgotten.
   - For code, scope it to the paths the graph pointed to.
   - For resources, config, build scripts, or a name you are renaming or deleting, scope it to the relevant folders (`res/`, the manifest, `*.gradle*`, config folders), or to the whole repo minus `graphify-out/` and build output.

5. **Broad read**, only when needed: you are rewriting a file, or the graph covers the area poorly.

### Enough context?

**The graph alone is enough** for questions about location and structure, when no edit depends on the answer: which file or symbol implements X, what calls X, what X uses, which files a change touches, how two areas connect.

**Before an edit**, answer each item that applies. Use the graph where it suffices and read where it does not.
- **The code you will change.** Read its current text: the whole function or class region. Never edit from graph output alone.
- **Who depends on it.** Run `affected --depth 1` when you change its contract, and read each call site you will update.
- **What it calls.** Read the signatures you will call with new arguments, and anything whose behaviour you rely on. `explain` gives the location.
- **What the graph usually cannot see.** Coverage varies, so `gm.py covers <file>` settles it when it matters. Grep these when the task touches them:
  - config and resources: XML layouts, AndroidManifest, string and navigation resources, JSON or YAML;
  - build scripts, SQL, string-keyed lookups, reflection and DI wiring, generated code.
- **Tests** for the area. Look for test nodes in the `affected --depth 1` output, which is not capped. `explain` shows only 20 neighbours, so a test missing from it proves nothing. If `affected` lists no tests, check by convention before concluding there are none: `src/test/`, `src/androidTest/`, `**/*Test.*`, `**/*_test.*`, `tests/test_<module>.py`. Kotlin and Java tests in the same package need no import, so they show no edge.
- **Project rules** from the notes' Rules section.

**For Android and Kotlin, also check:**
- A layout id or name is used as `R.id.snake_name` and `R.layout.x`, and as camelCase in view binding (`binding.snakeName`, `ActivityMainBinding`). Grep both forms.
- Classes named in XML (manifest `android:name`, navigation graphs, custom view tags) and in DI modules (`@Module`, `@Binds`, `@Provides`) must be grepped when you rename or change them.
- An interface change also hits every `override` implementation; grep `: InterfaceName` if `affected` lists none.
- A call into another Gradle module needs that module in the caller's `build.gradle(.kts)` dependencies.

**Read the real code, not just the graph, when:**
- **behaviour matters**: conditions, error handling, data shapes, the cause of a bug;
- **the edge you rely on is `INFERRED` or `AMBIGUOUS`** (only `EXTRACTED` edges come straight from the parser);
- **the file changed since the last build**;
- **the graph came back thin.** That means:
  - a public symbol shows no callers or only one;
  - the symbol is an Activity, Fragment, ViewModel, Service, DI-provided class, or anything referenced from XML;
  - or its file is not in the graph.

  Grep the name before trusting "no callers".

When you add or change logic in a hub, run one grep for the key literal it owns (a table, key, URL or format string) to find duplicated logic that should change too, and stop there unless it finds hits.

If every applicable item is answered, stop reading. If one is not, read only the lines that answer it. When unsure, ask: "If this is wrong, will I write incorrect code?" If yes, read.

### Not wasting what you have

- Do not re-run a query or re-read a range that is already in context.
- Prefer one `explain` over several broad `query` calls.
- When you hand exploration to a subagent, give it the project root and these four rules. Subagents do not get the session note.
  1. Use `graphify explain`, `affected --depth 1` or `query --depth 1` before reading.
  2. Read with offset/limit.
  3. Grep config and resources the graph cannot see.
  4. Return `file:line` facts, not file dumps.

## Other commands

With no argument, run `status` and list the commands.

| Command | What to do |
|---|---|
| `init` | Set up graph memory in the current folder. Follow `references/init.md`. |
| `update` | Run `gm.py update` (parser refresh, no tokens). Add `--force` when code was deleted or moved and graphify refuses to shrink the graph. `update --docs` means semantic extraction of docs, papers and images: invoke the graphify skill with `. --update`. That costs real tokens, so say so and get a yes first. |
| `status` | Run `gm.py status` and relay it in a few lines. `--benchmark` adds graphify's estimate of tokens saved per query. |
| `ask <question>` | Answer from the graph with the ladder. Cite `file:line`, and say what you could not confirm without reading code. If you answer from context or grep instead of the graph, start with the one-line reason (see Grep under The ladder). |
| `impact <symbol>` | Run `graphify affected` and `graphify explain`. List what a change would touch, grouped by file. Read nothing more unless asked to make the change. |
| `save [note]` | Update the notes. Follow `references/notes.md`. |
| `resume` | Run `gm.py session-start --plain`, then wait for the task. |
| `remove` | Undo init in this folder. Follow the Remove section of `references/init.md`. Confirm with the user first. |
| `help` | List the commands, one line each. |

## Project notes

The notes hold what neither the graph nor the code can: current work, rules, decisions, and how to build and test. Their Now, Rules and Overview sections reach every new chat, so keep them small and current. Update them, and say so in one line, when:
- a decision was made;
- the user stated a rule for this project;
- a feature was finished;
- the user is wrapping up with work still open.

Format and full procedure: `references/notes.md`.
