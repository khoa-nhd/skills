---
name: master-ui
description: One entry point for UI work that runs the best open design skills in a fixed pipeline and does the whole job itself. Builds new landing pages and marketing sites (ui-ux-pro-max for strategy, Hallmark to build, Design Motion Principles for motion, Impeccable to critique, audit and polish), and improves existing app UI (Impeccable critique and audit, targeted fixes, motion audit, harden, polish). Installs any missing skill into the project's own .claude/skills on first use. Use whenever someone asks to build, design, redesign, fix, polish, review or "make beautiful" a website, landing page, dashboard, screen or component, or says /master-ui, "làm landing page", "thiết kế web", "sửa giao diện", "làm đẹp app", "chỉnh UI", even without naming any skill.
argument-hint: "<what to build or fix> [path or URL] [--theme <name>] [--like <brand>] [--palette uupm] [--fast]"
---

# master-ui

One request in, a finished and checked UI out. This skill owns the order of work and the hand-offs; four upstream skills do the craft:

| Skill | Owns | Never does here |
|---|---|---|
| **ui-ux-pro-max** (UUPM) | strategy: product category, landing pattern, style and colour mood, anti-patterns, UX and stack rules | build pages; pick the palette over a theme, a brand file or an existing system (unless `--palette uupm`) |
| **Hallmark** | building new pages, redesigns that keep content and wiring, `sloplint` | touch an existing app outside a redesign |
| **Design Motion Principles** (DMP) | all motion: creating it and auditing it | break Hallmark's motion floor or the locked system |
| **Impeccable** | context files, critique, audit, every refine command, `detect` | `animate` (DMP owns motion); replace the locked system |

`awesome-design-md` (VoltAgent) is a library, not a skill: when the user wants "something like Linear/Stripe/Vercel", `scripts/design-md.mjs` fetches that brand's DESIGN.md.

## The rules that make them work together

1. **One source of truth: the root `DESIGN.md`.** Whoever sets the visual system writes it once; every later step reads it and keeps to it. Precedence, highest first: the user's own words → an existing `DESIGN.md` or the project's established system → a `--like` brand file → a Hallmark theme → UUPM tokens. Impeccable ("the brief wins") and Hallmark (a found `design.md` skips the theme deal) both honour this file.
2. **Floors stack, they do not cancel.** Every Hallmark Floor rule, Impeccable's craft floor and `prefers-reduced-motion` all hold at once. When two upstream rules disagree on something above the floors, the skill that owns that area (table above) wins; say which in one line.
3. **Never invent facts.** No metric, quote, logo, customer or address the user did not give. Missing material becomes a labelled slot or a credited library photo, listed in the final report.
4. **One question round at most, then drive it.** Upstream skills each want to ask (Hallmark's Step 1, Impeccable `init`'s interview, DMP's "does this weighting sound right?", Impeccable's "ask once if two commands fit"). Never let them ask one by one. When a workflow needs product truth it cannot read from the request or the project (landing and redesign without a `PRODUCT.md`), send **one** brief round: your inferred brief plus the material ask, answerable with "go ahead" (the question tool when the host has one). That single answer serves Hallmark's Step 1 and Impeccable's init alike. Everything after it you decide yourself and note in one line. Apart from that round, stop only before deleting a route, a component tree or user content.
5. **Load late, load little.** Read an upstream `SKILL.md` only when its phase starts, and only the reference files that phase needs. Never preload all four.
6. **Verify by looking.** Every phase that changes UI ends with a render check (screenshot at desktop and phone width) and the relevant linter. A claimed pass that was not run is a failure.

## Step 0: Pick the mode

Read the request and the project, then pick one and say it in the first line of your reply (`master-ui · mode: landing · …`):

| Mode | When | Workflow |
|---|---|---|
| **landing** | a new page or site: "làm landing page", "build a site for…", "trang giới thiệu", a route or folder that does not exist yet | [references/landing.md](references/landing.md) |
| **app** | improve UI that exists: "sửa", "chỉnh", "làm đẹp", "fix", "polish", "improve", "review", "audit" on files, a route or a running app | [references/app.md](references/app.md) |
| **redesign** | replace the look of an existing page while keeping its content and behaviour: "redesign", "làm lại giao diện", "thiết kế lại" | [references/app.md § Redesign](references/app.md#redesign) |
| **small** | one element or one concern: "nút này", "the header", "chỉ sửa màu", "make the cards bolder" | [references/app.md § Small](references/app.md#small) |

Tie-breakers: a new page inside a project that already has UI is **landing**, but the project's system is locked (rule 1). "Review"/"audit" with no request to change anything is **app** in report-only mode: stop after the findings. If two modes still fit, take the one that changes less.

Flags the user may type in words as well: `--like <brand>` ("giống Linear"), `--theme <name>` (a Hallmark theme), `--palette uupm` (lock UUPM's palette instead of a theme), `--fast` ("nhanh", "prototype": skip the finish tier, keep the floors).

## Step 1: Make sure the skills are there

```bash
node <skill-dir>/scripts/install.mjs --project <project-root> --set <landing|app|redesign|small>
```

`<skill-dir>` is the folder holding this file; `<project-root>` is the user's project (the git root, or the working folder). The script installs only into `<project-root>/.claude/skills/`, never globally, never installs hooks, skips skills already present (project or global), and pins each install's commit in `.claude/skills/.master-ui.lock.json`. On first install in a project, tell the user in one line which skills were added. Its last line, `MASTER_UI_SKILLS {json}`, maps each skill to its folder: use those folders below as each skill's `<skill-dir>`.

A skill installed in this session is not in the Skill tool's list yet. Do not wait for a reload: **read `<its dir>/SKILL.md` with the Read tool and follow it**, resolving its `<skill-dir>` / base-directory references to that folder. If a skill was already loadable, invoking it is equivalent.

Needs: git and Node 18+; Python 3 for UUPM (the script reports which `python` command works; use it). On Windows run Impeccable's launcher as `sh <dir>/scripts/impeccable <verb>` from Git Bash, or `<dir>/scripts/impeccable.cmd <verb>`. If an install fails, say which skill, continue with the others, and skip its phase with a note in the report.

To refresh pinned skills later: `--update`.

## Step 2: Run the workflow for the mode

Follow the reference file for the mode to the end. Each lists its phases, what each phase reads and writes, the hand-off to the next, and its budget of fix rounds.

## Step 3: Report

End with one short report, in the user's language:

- **Mode and decisions:** the inferences from rule 4, the system's source (theme / brand file / existing / UUPM), and any rule conflict you settled.
- **What changed:** files created or edited, with links.
- **Checks:** each linter and review that ran, its result (`sloplint 0 FAIL · detect 2 findings, 1 waived (brand font) · critique 31→36/40`), and anything you could not run and why.
- **Before / after** screenshots for app, redesign and small modes.
- **Material still wanted:** every slot or stand-in, what belongs there, and the one piece that would improve the page most.

Nothing else: no recap of the pipeline, no list of commands you ran.
