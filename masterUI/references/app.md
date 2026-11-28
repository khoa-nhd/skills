# App mode: improve UI that exists

`IMP`, `DMP`, `UUPM` and `HM` are the folders `install.mjs` printed. To run an Impeccable command, read `IMP/reference/<command>.md` and follow it on the target; read `IMP/reference/craft-floor.md` once before the first edit.

**Refinement preserves.** The project's own system is locked (SKILL.md rule 1): its tokens, fonts, components, copy, behaviour and everything outside the target stay as they are. UUPM never re-picks a palette here. If the request really asks for a new look, it is a [redesign](#redesign).

## 1. Target and baseline

- **Target:** the files, route or component the request names; with none named, the screens the request describes (find them by route and component names). Name the files you will touch in one line.
- **Run it:** start the dev server the project's own scripts define (`package.json`), on a free port; if it cannot run (secrets, a paid backend), say so in one line and work from the code and any committed screenshots.
- **Context:** `sh IMP/scripts/impeccable context --target <path>` (Windows without `sh`: `IMP/scripts/impeccable.cmd`). No `PRODUCT.md` is fine for scoped fixes: carry on from the code and suggest `init` in the report. No `DESIGN.md`: follow `IMP/reference/document.md` to write one from the code, so every later step keeps to the existing system.
- **Before:** `sh IMP/scripts/impeccable shot <url or file>` (desktop and phone), plus `sh IMP/scripts/impeccable detect <url>` (a URL runs the rules that need a render: contrast, tiny text).

## 2. Findings

Run, on the target only:

1. `critique <target>`: score and priority issues. Read `IMP/reference/critique.md`.
2. `audit <target>`: a11y, performance, theming, responsive, P0 to P3.
3. **Motion audit** when the target has motion or state changes (modals, menus, toasts, tabs, loading): read `DMP/SKILL.md`, then `DMP/workflows/audit.md`, with `--terminal` output. Weighting by project type from DMP's table (a SaaS dashboard is Emil primary, Jakub secondary); decide it, do not ask.

Merge everything into **one list**, deduplicated, ranked P0 → P3, each with file:line. In report-only mode ("review", "audit" with no ask to change), stop here and report the list.

## 3. Fix

Work down the list, P0 and P1 first, then P2 while the budget lasts. Each finding goes to the one owner that fixes it:

| Finding | Command |
|---|---|
| spacing, alignment, rhythm, hierarchy | `layout` |
| fonts, sizes, weights, line length | `typeset` |
| bland, timid, no focal point | `bolder` |
| loud, busy, overstimulating | `quieter` |
| clutter, too many elements or options | `distill` |
| grey and flat, colour without meaning | `colorize` |
| labels, errors, empty-state copy | `clarify` |
| breaks on phone or tablet | `adapt` |
| slow load, jank, layout shift | `optimize` |
| first run, empty states, activation | `onboard` |
| errors, loading, overflow, long text, i18n, edge cases | `harden` |
| motion missing, wrong or sloppy | DMP `workflows/create.md` (never `animate`) |
| a specific UX rule question (a WCAG criterion, touch target, form pattern) | `<python> "UUPM/scripts/search.py" "<outcome words>" --domain ux`, then `--stack <stack>` |

Narrow targets: one component or section per command. Several findings on one element share one command run. After each batch, re-take the screenshot and fix what it shows before the next batch.

## 4. Finish

1. `polish <target>`.
2. The project's own checks: typecheck, lint, tests, build (whatever `package.json` defines). A failure you caused is fixed before you report.
3. **After:** `shot` at the same sizes as the baseline, `detect` again; critique score again if step 2 ran it.
4. Report as SKILL.md Step 3, with before and after side by side and the critique score change.

## Budget

At most two fix batches plus one confirming look. Findings left over go in the report with file:line, ranked.

---

## Redesign

A new look for an existing page, keeping its content, links, fields and handlers.

1. Brief round only if there is no `PRODUCT.md` (SKILL.md rule 4), then `PRODUCT.md` via `IMP/reference/init.md`.
2. UUPM strategy as in [landing.md § 2](landing.md#2-strategy-uupm), for the pattern, mood and anti-patterns.
3. Read `HM/SKILL.md` and `HM/references/redesign.md`, then run Hallmark's redesign on the target: `sloplint --before` records every link, field, handler and heading; the build replaces system and layout; `sloplint --kept` must pass. "Keep the layout" in the request → a restyle; "polish" → only the tells (Hallmark's sweep for a page it did not build).
4. Motion ([landing.md § 4](landing.md#4-motion-dmp)), then Impeccable refine and the final gate ([landing.md § 5 and § 6](landing.md#5-refine-impeccable)).
5. Report with before and after.

Never delete a route or a component tree without a file-level plan the user approved.

---

## Small

One element or one concern ("make this button better", "the header is cramped", "chỉ sửa màu").

1. `impeccable context --target <file>`, a `shot` of the element.
2. The single command from the table in § 3 that the request names or implies (motion → DMP create). If two fit equally, pick the narrower and say so.
3. `shot` again, `detect` on the file, the project's typecheck or lint if it has one.
4. A three-line report: what changed, the before/after shot, anything noticed but left alone.
