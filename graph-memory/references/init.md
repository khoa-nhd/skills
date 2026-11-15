# Init and remove

## Init

Goal: once init is done, any new chat in this folder starts with the graph and the notes, and follows the lookup rules with no manual steps.

1. Run `python ~/.claude/skills/graph-memory/scripts/gm.py init` from the folder the user wants to set up, normally the current one. In one call it:
   - checks that the graphify CLI is installed;
   - builds the graph with `graphify update .` if there is none, or refreshes it (parser pass, no tokens);
   - installs graphify's git hooks in a git repo, so the graph rebuilds in the background after commit, checkout, merge and rebase;
   - writes the `## graph-memory` section into CLAUDE.md, between markers so later runs can update or remove it cleanly;
   - creates `.claude/graph-memory.md` from the template if it is missing;
   - sets `query_budget=1000` in `.graphifyrc` unless a budget is already set, so `graphify query` answers stay small;
   - adds `.claude/` and `CLAUDE.md` to `.graphifyignore`. Claude reads those directly, and indexing them would only add noise nodes to the graph.

   Options:
   - `--no-git-hooks` skips the git hooks.
   - `--guard` also runs `graphify claude install`. That adds graphify's own CLAUDE.md section and a PreToolUse guard that nudges, and in strict mode blocks, raw reads before a graph query. It costs about 1 to 2 seconds on every Read, Grep, Glob and Bash call on Windows. Add it only when the user asks for stricter enforcement.

2. If init says graphify is missing, tell the user and offer to install it with `pip install graphifyy` (the package name has two y's). Installing a package needs their OK.

3. If init warns that a parent folder already has graph memory, ask whether they want a separate memory for this subfolder or prefer to work from the parent.

4. Fill the Overview section of the notes, but only if it is still empty. Keep it to about 5 lines: what the project is, the stack, the entry points, and how to run and test it. Take facts from cheap sources only:
   - the first screen of the README;
   - the package manifest (package.json scripts, pyproject.toml, Cargo.toml, Makefile targets);
   - the Summary and God Nodes parts of `graphify-out/GRAPH_REPORT.md`.

   Do not explore the codebase for this. It is a seed that later saves refine.

5. Init prints the doc count. If the folder is documentation-heavy, mention that `/graph-memory update --docs` would add semantic doc extraction at a token cost. Do not run it unasked.

6. Report back in a few lines: the graph size, what was written where, and that new chats in this folder pick it up automatically. If init says `graphify-out/` is not git-ignored, mention it and let the user decide.

## Remove

1. Run `gm.py remove --dry-run` and tell the user what it would change. Get their OK before running it for real.

2. `gm.py remove` takes out the CLAUDE.md section and the `.graphifyrc` lines that init added. It keeps the graph and the notes file. It touches graphify's own pieces only when asked, since the user may have installed them separately:
   - `--git-hooks` uninstalls graphify's git hooks;
   - `--guard` runs `graphify claude uninstall`.

3. `--purge` also deletes `graphify-out/` and `.claude/graph-memory.md`. This cannot be undone. Name both paths to the user, get an explicit yes, then run with `--purge --yes`.
