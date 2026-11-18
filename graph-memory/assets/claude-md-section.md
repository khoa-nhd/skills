## graph-memory

Graph memory is on for this folder: a graphify code graph in `graphify-out/` and project notes in `.claude/graph-memory.md`. The session-start note shows their current state; if you did not get one, run `/graph-memory resume`. For coding tasks the user may type `/graph-memory use <task>`. Work the same way either way: spend tokens on the lines that matter, and never trade correctness for it.

`gm.py` below means `python $HOME/.claude/skills/graph-memory/scripts/gm.py`.

- **Locate through the graph first**, run from this folder:
  - `graphify explain "<Symbol>"`: file:line plus up to 20 neighbours; not a full caller list;
  - `graphify affected "<Symbol>" --depth 1`: direct dependents;
  - `graphify path "<A>" "<B>"`;
  - `graphify query "<identifiers>" --depth 1` for discovery.

  Use names as written in code; for a method, qualify it as `Class.method`. On no match, run `gm.py nodes <word>`; after two misses, grep. When unsure whether the graph covers some files, check with `gm.py covers <file>...` (0 nodes: grep them) rather than assuming. Whenever you grep instead of using the graph, say why in one line (`Lookup: grep, because ...`). If the session note lists changed files, run `gm.py update` once before the first lookup. Call the graphify CLI directly; the graphify skill is only for semantic doc builds.
- **Read only what the task needs**, with offset/limit: the whole function or class you will change, each call site you will update, any callee whose behaviour you rely on, and the area's tests. The graph cannot see config and resources (XML layouts, manifests, strings, navigation), build scripts, SQL, string-keyed lookups or DI/reflection wiring, so grep those when the task touches them. Kotlin/Java tests in the same package show no edge; look in `src/test/` and similar folders.
- **Before the first edit, write one or two lines**: `Context: have ... Reading ... because ... Skipping ...`. Before reporting, check that each Reading item was read.
  - The graph alone answers where-is and what-calls-what.
  - Read real code before editing it, when behaviour matters, when an edge is INFERRED or AMBIGUOUS, or when the file changed since the build.
  - Before trusting "no callers", grep the name. Always do this for Activities, Services, ViewModels, DI-provided and XML-referenced classes.
  - When you change a contract, run `affected --depth 1` and update every direct dependent. Also grep:
    - implementations (`: InterfaceName`);
    - XML, manifest and DI references;
    - both `R.id.x` and `binding.x` forms.
  - Add or update a test when the area has tests.
- **After editing**, run the narrowest build or test covering the change and its dependents, and fix your failures; name anything that could not run. Then run `gm.py update` (the Stop hook also refreshes the graph later).
- **Keep `.claude/graph-memory.md` current:**
  - finished feature: a Log line, plus refresh Now;
  - a decision or rule: add it;
  - stopping mid-task: `/graph-memory save`.

  No secrets.
