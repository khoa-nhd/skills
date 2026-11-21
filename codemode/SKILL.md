---
name: codemode
description: Batch repetitive tool work into one JavaScript script with undo, guardrails, and compact output. Use for /codemode, "code mode", or predictable multi-file work such as renames, codemods, bulk fixes, repo-wide audits, and filtering large output. Skip small edits and work that needs judgment after each result.
argument-hint: "<task>"
---

# Code Mode

Do the mechanical part of a task in one script, run it with `scripts/run.mjs`, and read a short JSON report.

Use it when the plan is predictable and would otherwise take about five or more related calls. Use normal tools for smaller tasks, debugging, or edits that need judgment per file.

## Run

Aim for one run: put discovery, the change, and the check in the same script. For a short script, use Bash from the project directory:

```bash
node "<skill-dir>/scripts/run.mjs" <<'JS'
const hits = grep(/\bfetchUser\b/, { glob: 'src/**/*.{js,ts}' });
const files = [...new Set(hits.map((h) => h.file))];
for (const f of files) edit(f, /\bfetchUser\b/g, 'loadUser');
const test = await sh.try('npm test');
return { files: files.length, passed: test.ok, failure: test.ok ? null : tail(test.stdout, 15) };
JS
```

For a script over about 40 lines, or if a heredoc fails to parse, save it once with Write to a temp folder outside the project and run `node "<skill-dir>/scripts/run.mjs" <file>`. Don't resend a long script through a heredoc.

The body allows top-level `await` and ends with `return`.

```text
await sh(cmd, {cwd, timeout, readonly})   throws on failure
await sh.try(cmd, opts)                   {ok, code, stdout, stderr}
read(file)  exists(file)  write(file, text)
edit(file, find, replace, {all})          string or RegExp; throws on no match
move(from, to)  remove(file)
glob(pattern)                             respects .gitignore; no "/" = any depth
grep(textOrRegExp, {glob, max})           [{file, line, text}]
await pmap(items, fn, {limit, settle})    parallel map
head(text, n)  tail(text, n)  path  cwd  root  dryRun
```

Change files only through these helpers, because only they are journaled for undo.

## Rules

- Return counts, file lists, and failure tails rather than raw output. Include how many items were matched, changed, and skipped, so a filter can't hide a case.
- Use `\bname\b` for renames and check near-matches such as `nameSuffix`.
- Use `--dry-run` only before a risky rule that changes more than about ten files. Read-only scripts don't need it.
- The script stops at 110 seconds. For longer work, pass `--timeout=<ms>` and set a longer Bash timeout.
- If `ok` is false, read `error`. Earlier changes stay in place, so fix the script or restore them with `--undo=<run-id>`.
- If the report has `refused`, don't work around it. Run that step as a normal tool call so the user's permission check applies. The guards aren't a security boundary.
- Confirm the goal with the tests, a build, or a check inside the script before reporting success.
