# master-ui

One entry point for UI work. You say what you want ("make a landing page for my roastery", "the settings screen feels cramped, fix it"); master-ui picks the mode, installs whatever design skills the project is missing, and runs them in a fixed order until the page is built, refined and checked.

It writes no design rules of its own. It orchestrates four open skills and one library, and owns only the order of work, the hand-offs and the rules that stop them from fighting:

| Upstream | Role in master-ui | License |
|---|---|---|
| [ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | strategy: landing pattern, style and colour mood, industry anti-patterns, UX and stack rules | MIT |
| [Hallmark](https://github.com/nutlope/hallmark) | builds new pages and redesigns; `sloplint` | MIT |
| [Design Motion Principles](https://github.com/kylezantos/design-motion-principles) | creates and audits motion | MIT |
| [Impeccable](https://github.com/pbakaus/impeccable) | context files, critique, audit, refine commands, `detect` | Apache-2.0 |
| [awesome-design-md](https://github.com/VoltAgent/awesome-design-md) | brand DESIGN.md files for "make it look like Linear" | MIT |

Nothing upstream is copied into this repo. The installer fetches each skill from its own repository into the target project.

## Modes

| Mode | Triggered by | Pipeline |
|---|---|---|
| landing | a new page or site | brief → UUPM strategy → Hallmark build (theme or locked DESIGN.md) → DMP motion → Impeccable critique, fixes, audit, harden, polish → sloplint + detect |
| app | fixing or improving existing UI | baseline shots + detect → critique + audit + motion audit → one ranked list → fixes routed to the owning command → polish → project checks → before/after |
| redesign | "redesign", "làm lại giao diện" | UUPM strategy → Hallmark redesign (keeps every link, field, handler) → motion → refine → final gate |
| small | one element or one concern | one Impeccable command (or DMP for motion) → shot → detect |

Details: [SKILL.md](SKILL.md), [references/landing.md](references/landing.md), [references/app.md](references/app.md).

## How the skills are kept from fighting

- **One `DESIGN.md` is the truth.** Precedence: your words → an existing DESIGN.md or the project's system → a `--like <brand>` file → a Hallmark theme → UUPM's palette. UUPM's palette is used only when asked (`--palette uupm`): in testing it suggested green and hot pink for a coffee roastery, while Hallmark dealt three themes made for one. UUPM's pattern, mood and anti-patterns are always used.
- **Each area has one owner.** Motion is DMP's (Impeccable's `animate` is not used). Building is Hallmark's. Review and refinement are Impeccable's.
- **Floors stack.** Hallmark's Floor, Impeccable's craft floor and reduced-motion all hold together.
- **One question round at most.** The upstream skills each want to interview you; master-ui asks once (an inferred brief you can accept with "go ahead") and answers the rest itself.
- **No invented facts.** Missing photos, numbers or quotes become labelled slots, listed at the end.

## Install

Link this folder into Claude Code's skills folder under the name `master-ui`:

```bash
# macOS / Linux
ln -s "$(pwd)/masterUI" ~/.claude/skills/master-ui
```

```powershell
# Windows (a junction needs no admin rights)
New-Item -ItemType Junction -Path "$HOME\.claude\skills\master-ui" -Target "$PWD\masterUI"
```

The design skills themselves are installed per project, on first use, by:

```bash
node masterUI/scripts/install.mjs --project <project> --set landing|app|redesign|small   # install what is missing
node masterUI/scripts/install.mjs --project <project> --check                           # report only
node masterUI/scripts/install.mjs --project <project> --set landing --update            # refresh to upstream HEAD
```

They land in `<project>/.claude/skills/`, never globally, with each commit pinned in `.claude/skills/.master-ui.lock.json`. No hooks are installed. A skill already installed globally is used as it is. Needs git, Node 18+, and Python 3 for ui-ux-pro-max. Hallmark's `sloplint --render` also wants `puppeteer-core` and Chrome; without them master-ui runs the static checks and takes screenshots with Impeccable's `shot`.

Brand files:

```bash
node masterUI/scripts/design-md.mjs find linear
node masterUI/scripts/design-md.mjs get linear.app --out DESIGN.md
```

## Use

```
/master-ui make a landing page for a family guesthouse on the Ligurian coast
/master-ui the billing page feels cramped and the empty state is ugly, fix it
/master-ui redesign src/app/pricing, keep the layout
/master-ui làm landing page cho app quản lý chi tiêu, giống Linear
```

Or just ask for UI work without naming it; the description triggers on build, redesign, fix and polish requests.
