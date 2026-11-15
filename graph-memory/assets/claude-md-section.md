## graph-memory

Graph memory is on for this folder: a graphify code graph in `graphify-out/` and project notes in `.claude/graph-memory.md`. The session-start note shows their current state; if you did not get one, run `/graph-memory resume`. Look things up through them before raw search, so tokens go to the few lines that matter.

- Find code through the graph first, run from this folder: `graphify explain "<Symbol>"` (file:line plus neighbours), `graphify affected "<Symbol>"` (what depends on it), `graphify path "<A>" "<B>"`, or `graphify query "<identifiers>" --depth 1` for discovery. Use names as written in the code. On "No matching nodes", run `python ~/.claude/skills/graph-memory/scripts/gm.py nodes <word>`; after two misses, use grep. Call the graphify CLI directly; the graphify skill is only needed for semantic doc builds.
- Then read only the lines the graph located (Read with offset/limit), not whole files.
- The graph alone answers where-is and what-calls-what. Read the real code before editing it, when behaviour matters (logic, bugs, data shapes), when an edge is INFERRED or AMBIGUOUS, or when the file changed since the last build.
- Before changing a signature or shared type, run `graphify affected` and read each call site you will change.
- After a batch of code edits, run `graphify update .` (parser only, no tokens).
- Keep `.claude/graph-memory.md` current: after a decision, a new project rule, or when stopping mid-task, update it as the graph-memory skill describes (`/graph-memory save`). No secrets in it.
