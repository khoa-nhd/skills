## graph-memory

Graph memory is on here: a code graph in `graphify-out/` and notes in `.claude/graph-memory.md`. `gm.py` means `python $HOME/.claude/skills/graph-memory/scripts/gm.py`. Follow these rules for every coding task, whether or not it comes as `/graph-memory use <task>`.
- Call the graphify CLI directly. Never load the graphify skill; only `/graph-memory update --docs` needs it.
- If there was no session note at the start, run `gm.py session-start --plain`.

1. **Locate in one Bash call** from this folder, with commands joined by `;`. If the session note lists changed files, start the call with `gm.py update;`. Write names as they appear in code, and methods as `Class.method`.
   - `graphify explain "<Symbol>"`: `file:line` plus 20 neighbours. That is not a full caller list.
   - `graphify affected "<Symbol>" --depth 1`: direct dependents. Run it only if a contract may change.
   - `graphify query "<names>" --depth 1`: only when you do not know the names.

   Put likely follow-ups into the same call:
   - `gm.py nodes <word>` if you are unsure of a name;
   - `grep -rn "<Name>"` for a public symbol, an Activity, Fragment, ViewModel or Service, or anything referenced from XML or DI. The graph shows these with few or no callers.
   - a grep of the test folders for the class, since same-package tests have no graph edge.

   The graph does not see literals and string keys, config and build scripts, resources (XML, manifest, strings, navigation), SQL, DI or reflection. Grep those when the task touches them. Whenever you grep instead of using the graph, say why in one line.

2. **Before the first edit**, write `Context: have ... Reading ... because ... Skipping ...`. Then read exactly that, with all ranges in one message (parallel Reads, or one `sed -n` call):
   - the whole function or class you will change, to its end. Never edit a region you have only partly read. Read a whole file only if it is under about 80 lines or you are rewriting it.
   - every direct dependent you will update;
   - callees whose behaviour you rely on;
   - the tests for the area;
   - the notes' Rules, if the session note cut them and the task touches them.

   Treat `INFERRED` and `AMBIGUOUS` edges as unconfirmed. If your reads reveal more dependencies, check them in one more batch.

3. **Edit.** A contract change means a signature or parameter (even one with a default), a return value, errors, side effects, a data shape, a rename or delete, an interface, abstract, enum or sealed member, or an XML or DI entry. When you make one:
   - update or clear every direct dependent;
   - grep implementers (`: Name`) and `when` sites;
   - for a rename or delete, grep the whole repo, and for views grep both `R.id.x` and `binding.x`.

   Add or update a test where the area has tests.

4. **Verify** in one call: the narrowest compile and test commands that cover the change and its dependents, other modules included. The session note's Overview names the commands. A slow build is no reason to skip. Fix your own failures, report unrelated ones as possibly pre-existing, and name what could not run.

5. **Report** briefly: what changed, how it was verified, and what was not. Before that, check that every "Reading" item was read and every dependent updated or cleared.
   - Do not refresh the graph: the Stop hook does it after every reply, including before later tasks.
   - The exception is deleted or moved code: run `gm.py update` once at the end, and if it says graphify kept the old graph, run it again with `--force`.
   - Edit the notes only when the user made a decision or stated a rule, or work is left unfinished.

If two lookups miss, or a test failure cannot be placed, see `~/.claude/skills/graph-memory/references/lookup.md`. When unsure whether to read something, ask: "If this is wrong, will I write incorrect code?" If yes, read it.
