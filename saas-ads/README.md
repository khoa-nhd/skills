# saas-ads

A Claude Code skill that makes premium, cinematic SaaS-style promo videos (30–60 s, 16:9 and 9:16) for any web or mobile app, in [Remotion](https://www.remotion.dev), from the product's real UI.

It packages what it took seven versions of a real class-portal promo to learn, plus a frame-by-frame study of eight reference ads (NeuraFlow, LangEase, iBanFirst, Numtera, Sber, PING, Spotify and Yonomi breakdowns):

- **A story, not a feature list**: hook → meet → overview → 2–3 hero stories → quick pass → notifications on the chorus → phone → promise → logo on the final hit. Each feature appears once.
- **One continuous camera**: the real UI rises from a glowing horizon, pulls back to a wall of pages, flies into a page; elements leave the screen, become objects, then return before the next move.
- **Polish rules** from every review comment: no overlapping text, whole subject visible before a transition, lists that close up, navigation you can see, a short ending, a clean 9:16.
- **Music and sound**: tempo and beat-phase analysis, bar-aligned splicing so the entrance, chorus and final hit land on the right shots, and synthesized UI sound design (typing, ticks, whooshes, dings, risers, hits with ducking).

## Contents

| Path | What it is |
|---|---|
| `SKILL.md` | The workflow Claude follows |
| `references/patterns.md` | What premium SaaS ads show, transition catalogue with timestamps, why they feel cinematic |
| `references/polish-checklist.md` | Rules from review feedback and the pre-render checklist |
| `references/scene-recipes.md` | Code-level recipes for every beat |
| `references/music-and-sound.md` | Choosing, analysing and splicing music; sound-design vocabulary |
| `references/capture-ui.md` | Capturing plates and element rects; privacy |
| `references/remotion-gotchas.md` | 3D, filter and timing traps |
| `assets/kit/` | Remotion components: brand tokens, kinetic type, keyframe tracks, stages, horizon, 3D space, plates, page camera, cards, cursor, check ring, confetti, logo tile, orb, toast, comet, whip/punch/pulse |
| `scripts/capture-plates.mjs` | High-DPR screenshots + element rects → `public/plates`, `src/plates.ts` |
| `scripts/analyze-music.cjs` | Tempo, beat phase, loudness, section edges |
| `scripts/score.cjs` | Splice the track, synthesize cues, mix to WAV |
| `scripts/contact-sheet.mjs` | Render chosen frames into one labelled sheet for review |

## Install

Link or copy the folder into `~/.claude/skills/saas-ads/`. The scripts need Node 22+ and ffmpeg; the kit needs a Remotion 4 project with `@remotion/google-fonts`, `@remotion/media` and `lucide-react`.

Then ask Claude something like *"make a 45-second promo for my app at localhost:3000, in 16:9 and 9:16"*.
