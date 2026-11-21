# codemode

A Claude Code skill that brings the idea behind the experimental [Code Mode](https://code.claude.com/docs/en/code-mode) to any surface with Bash, including the Desktop app. For predictable multi-file work, Claude writes one JavaScript script, runs it once, and reads a short JSON report.

This is an independent skill, not Anthropic's Code Mode. It works through the normal Bash tool and needs no experimental flag.

## Should you use it?

Use it for repetitive work where undo, guardrails, and compact output are useful:

- renames and codemods across many files;
- bulk fixes that follow one rule;
- repo-wide audits;
- filtering large search or log output.

Don't expect it to cut your token bill on small tasks. In the benchmark below it was roughly token-neutral, because Claude already writes its own batch scripts for jobs like these. Its main value is safer execution.

## Install

You need [Node.js](https://nodejs.org/) 22 or later and git. On Windows, you also need Git for Windows.

From the root of this repo, link the skill into Claude Code.

PowerShell:

```powershell
New-Item -ItemType Junction -Path "$HOME\.claude\skills\codemode" -Target "$PWD\codemode"
```

macOS or Linux:

```bash
ln -s "$PWD/codemode" ~/.claude/skills/codemode
```

Start a new session afterward. Claude can then use the skill automatically, or you can run:

```text
/codemode rename fetchUser to loadUser across the project and run the tests
```

## How it works

Claude pipes a script to `scripts/run.mjs`:

```js
const hits = grep(/\bfetchUser\b/, { glob: 'src/**/*.{js,ts}' });
const files = [...new Set(hits.map((h) => h.file))];
for (const f of files) edit(f, /\bfetchUser\b/g, 'loadUser');
const test = await sh.try('npm test');
return { files: files.length, passed: test.ok };
```

The runner prints one capped report and saves the full version to a temp file if it is too long:

```json
{"ok":true,"run":"20261121032136-3909","result":{"files":3,"passed":true},"changedCount":3,"changed":["M src/a.js +1 -1"],"undo":"--undo=20261121032136-3909","ms":412}
```

| Feature | What it does |
|---|---|
| Helpers | `sh`, `read`, `write`, `edit`, `move`, `remove`, `glob`, `grep`, `pmap`, `head`, `tail` |
| Dry run | `--dry-run` previews diffs without writing files and skips commands not marked read-only |
| Undo | `--undo=<run-id>` restores a run's files and won't overwrite later changes without `--force` |
| Safe edits | Refuses ambiguous matches and non-UTF-8 files, and keeps CRLF line endings and BOMs |
| Time limits | Stops hung commands and blocking loops, 110 seconds by default |

## Guardrails

Scripts are refused when they try to:

- touch secrets files, `.git`, `.claude`, `.husky`, or paths outside the project;
- match a `deny` or `ask` rule in your Claude Code settings;
- commit, push, install or publish packages, force-delete files, deploy, or send data with common network tools.

Claude is told to run a refused step as a normal tool call, so your usual permission prompt applies.

**These guards are not a security boundary.** A script runs with full Node.js access and could bypass them, and Claude Code's permission system sees only the outer `node run.mjs` command. Don't auto-approve that command on untrusted code. Use a container or VM when you need real isolation.

## Benchmark

Three tasks were run once with the skill and once without, using the same model and fresh git repos. All 24 checks passed in both configurations.

| Task | Tokens with skill | Tokens without | Difference |
|---|---:|---:|---:|
| Rename an option across 11 files | 60,544 | 61,386 | -1.4% |
| Audit links in 14 Markdown files | 62,942 | 62,434 | +0.8% |
| One-line edit | 58,306 | 56,376 | +3.4% |
| **Total** | **181,792** | **180,196** | **+0.9%** |

With one run per task, these differences are within normal variation. Totals also include a large fixed session context. The fixtures are small, so this doesn't show how the skill behaves on large repositories.

## Limitations

- Only changes made through the helpers can be undone. Side effects of `sh` commands can't.
- Claude Code's rewind doesn't track the runner's file changes, so use `--undo` or git.
- MCP tools, subagents, and Claude Code's built-in tools can't be called from a script.
- A skill is guidance, so Claude may sometimes choose normal tools instead.

## Tests

```bash
node --test codemode/tests/
```

The `evals/` folder holds the benchmark tasks, fixtures, and grading criteria.
