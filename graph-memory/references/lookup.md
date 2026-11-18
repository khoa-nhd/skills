# Lookup details

The detail behind the short rules in SKILL.md. Read this only when those rules leave you stuck: an ambiguous name, a thin graph result, an Android or DI corner case, or a failing test you cannot place.

## graphify commands

Run them from the project root; the session note names the root when the chat starts in a subfolder. Batch several into one Bash call. Refresh the graph only through `gm.py update`.

- `graphify explain "<Symbol>"`: file and line, plus up to 20 neighbours with `file:line` and edge confidence. It is not a full caller list; `--all` lists every neighbour.
- `graphify affected "<Symbol>" --depth 1`: the direct dependents, which are the call sites you may need to edit. The output is not capped. The default depth 2 shows indirect reach; use it to judge impact, not as a list to read.
- `graphify path "<A>" "<B>"`: how two parts connect.
- `graphify query "<identifiers>" --depth 1`: discovery. The answer is capped at the project's budget (init sets 1000 tokens); raise it with `--budget` only if the cut part matters.

**Name matching** is literal on node labels: no synonyms, no translation, and trailing `()` is optional.
- **Exit code 3** means the name is ambiguous. Pick the candidate whose file is in the area you are working on, and use its full label.
- **Common method names** (`onCreate`, `invoke`, `bind`): qualify them as `Class.method`. Running `affected` on the class lists who uses the class, not who calls the method.
- **Exit code 4** means no match. Run `gm.py nodes <word> [word...]`. After two misses, grep.

## Coverage

What graphify extracts varies by language and project.
- **Checking coverage:**
  - `gm.py covers <file>...` gives the node count per file; 0 means the graph knows nothing about that file's contents.
  - `gm.py nodes <name>` checks for a symbol.
- **Usually not covered:**
  - config and resources: XML layouts, AndroidManifest, string and navigation resources, JSON, YAML;
  - build scripts, SQL, string-keyed lookups, reflection and DI wiring, generated code.
- **Grep scope:**
  - For code, grep the paths the graph pointed to.
  - For resources, config, build scripts, or a name you are renaming or deleting, grep the relevant folders (`res/`, the manifest, `*.gradle*`, config folders), or the whole repo minus `graphify-out/` and build output.

## When the graph result is thin

Read or grep, rather than trusting "no callers", when:
- a public symbol shows no callers or only one;
- the symbol is an Activity, Fragment, ViewModel, Service, a DI-provided class, or anything referenced from XML;
- its file is not in the graph, or changed since the last build;
- the edge you rely on is `INFERRED` or `AMBIGUOUS` (only `EXTRACTED` edges come straight from the parser).

## Contract changes

- **Additive code needs no `affected` run:** a new standalone function, class or command that nothing references yet.
- **Anything else that touches a contract does.** That includes adding a member to an interface or abstract class, a value to an enum or sealed hierarchy, a parameter (even one with a default), or an entry in XML or DI. Run `affected --depth 1` on the type, and grep its implementers and `when` sites.
- **Hubs:** when you change logic in a hub, run one grep for the key literal it owns (a table, key, URL or format string) to find duplicated logic. Stop there unless it finds hits.

## Android and Kotlin

- **Layout ids** appear as `R.id.snake_name` and `R.layout.x`, and in view binding as camelCase (`binding.snakeName`, `ActivityMainBinding`). Grep both forms.
- **Classes named outside Kotlin**, in XML (manifest `android:name`, navigation graphs, custom view tags) or in DI modules (`@Module`, `@Binds`, `@Provides`), must be grepped when you rename or change them.
- **Interface changes** reach every `override`. Grep `: InterfaceName` if `affected` lists none.
- **Calls into another Gradle module** need that module in the caller's `build.gradle(.kts)` dependencies.
- **Tests in the same package** need no import, so they show no graph edge. Look in `src/test/` and `src/androidTest/`, and for files named `*Test.*`.

## Tests and verification

- **Finding tests:** look for test nodes in `affected --depth 1` output. If none appear, check by convention: `src/test/`, `src/androidTest/`, `**/*Test.*`, `**/*_test.*`, `tests/test_<module>.py`.
- **Commands:** use the notes' Overview, or the project's standard ones, for example:
  - Gradle: `./gradlew :<module>:compileDebugKotlin :<module>:testDebugUnitTest` (`gradlew.bat` in cmd);
  - `npm test`, `pytest path/to/test_x.py`, `cargo test`.
- **Cross-module changes:** if a contract used by another module changed, build or test that module too.
- **When a test fails:**
  - Read the failure first: does it touch code you changed?
  - Use `git stash` to check the code before your change only in a git repo whose uncommitted changes are all yours, and run `git stash pop` right after.
  - Otherwise report the failure as possibly pre-existing. Do not "fix" unrelated failures.
- **What cannot run here** (side-effecting entry points, device-only features): name it in your report.

## Subagents

Subagents do not get the session note. When you hand them exploration, give them the project root and four rules:
1. Use `graphify explain`, `affected --depth 1` or `query --depth 1` before reading.
2. Read with offset/limit.
3. Grep config and resources the graph cannot see.
4. Return `file:line` facts, not file dumps.
