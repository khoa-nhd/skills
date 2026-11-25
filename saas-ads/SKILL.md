---
name: saas-ads
description: Make a premium, cinematic SaaS-style promo video (30-60 s, 16:9 and 9:16) for any web app, website or mobile app, built in Remotion from the product's real UI, with beat-synced music and sound design. Use this skill whenever someone wants a product ad, launch video, promo, explainer, sizzle reel, app trailer or "video giới thiệu / quảng cáo" for software they built, even if they only say "make a video for my app", "quay video quảng cáo cho web", or share a URL and ask for something to post on social media.
---

# saas-ads

Turn a real product into a 30-60 s ad that feels like the best SaaS launch videos (Linear, Numtera, iBanFirst, NeuraFlow, LangEase, Sber): one continuous camera, the real UI pulled out of the screen and turned into objects, short kinetic type, cuts on the beat, and a final hit that lands on the logo.

Everything here was learned the hard way over seven versions of a real promo and a frame-by-frame study of eight reference ads. The references explain *why*; keep them in mind rather than copying any one ad.

## What you need before starting

Ask (with clickable choices when the host has a question tool) only for what you cannot find yourself:

1. **The product**: name, URL or repo, one-line promise, the 4-6 features that matter, brand colours, logo (or let a monogram tile stand in).
2. **Audience and language** of the on-screen text. Write captions in that language from the start.
3. **Format and length**: default both 16:9 and 9:16, 45-60 s. Shorter (30 s) means fewer stories, not faster ones.
4. **Music**: offer 3-4 royalty-free tracks on a listening page (Mixkit: no attribution needed) and let the user pick; if they defer, pick the one whose structure fits (quiet intro, a clear entrance, a later chorus, a clean final hit). See `references/music-and-sound.md`.
5. **Privacy**: if the UI shows real people (names, emails, avatars, grades), sanitize before capturing. Never put real personal data in the video.

If the user has reference videos, study them first (the `watch` skill, then dense 8 fps contact sheets of the transitions; see `references/patterns.md` § Studying references).

## Workflow

### 1. Capture the real UI as plates
Real screenshots beat redrawn mock-ups: they are instantly credible and they carry the product's own polish. Capture each key page at high pixel density together with the rectangles of the elements you will animate (cards, rows, buttons, sidebar items), using `scripts/capture-plates.mjs` (`references/capture-ui.md`). The output is `public/plates/*.jpg` plus a typed `src/plates.ts`, so scenes can crop, lift and highlight exact elements.

Pages the product lacks, or that would leak data, can be drawn in the product's own colours inside the real page frame (sample colours from the plates; patch the sidebar highlight and breadcrumb).

### 2. Write the script as a story, not a feature list
Use the arc every strong reference shares, and say each feature exactly once:

| Beat | What happens | Typical length |
|---|---|---|
| Hook | The pain, as typed questions over floating chat chaos | 3-4 s |
| Meet | Huge word ("Meet"/"Gặp"), the logo tile, a one-line promise in a glowing pill | 4 s |
| Overview | The real dashboard rises from behind a glowing horizon, its cards lift; pull back to a wall of every page; fly into the first page | 5-6 s |
| 2-3 hero stories | Each: a real interaction in the UI → the UI leaves the screen and becomes an object → a visible result | 5-6 s each |
| Quick pass | The remaining features, one beat each, on a contrasting light stage | 3-6 s |
| Notifications | Toasts burst from a bell on the chorus, one per beat | 4-5 s |
| Phone | One glass phone, blocks lifting as an orb taps them: "on your phone too" | 5-7 s |
| Promise | Three short promises, one per two beats | 3-4 s |
| Logo | Logo tile, wordmark, URL pill landing on the track's final hit | 3-4 s |

Rules that came straight from user feedback (details in `references/polish-checklist.md`):
- **Each feature appears once.** Q&A shown in the tour, a toast, the phone and its own scene reads as padding. The phone shows one screen, not a replay of the tour.
- **One caption pattern** for features, e.g. "Feature: benefit." Two to six words, brand-coloured keywords.
- **Give every hero story its own mechanic** (card pops out and flips; rows fly into a "done" box; a question bubble and its answers), never the same zoom-and-caption six times.
- **Show navigation**: click the sidebar item and let the page slide in before featuring it.
- **Return before you leave**: an element that popped out goes back to its slot, the camera pulls back to show the whole card/page, *then* the transition starts.
- **Keep the ending short.** Promise + logo ≈ 7-8 s total.

Show the user the beat table before building; it is cheap to change now and expensive later.

### 3. Lock music and the beat grid
Analyse the chosen track (`scripts/analyze-music.cjs`): tempo, beat phase, loud sections. Splice the track on bar boundaries so the entrance lands on Meet, a chorus lands on the notification burst, and the final hit lands on the URL. At 30 fps and 120 BPM one beat is 15 frames; put every cut and every pop on that grid.

### 4. Build in Remotion with the kit
Copy `assets/kit/` into `src/kit/` of a Remotion project (create one with the Remotion skill if needed; add `@remotion/google-fonts`, `@remotion/media`, `lucide-react`). Set brand tokens and the font in `brand.ts` (pick a font that covers the caption language). Then build scenes from the recipes in `references/scene-recipes.md`: letter dive, horizon rise, page wall, page camera with sidebar navigation, pop-out flip card, rows closing up, notification burst, glass phone, light-stage quick pass, promise, logo.

Structure: one `Sequence` per scene, and a nested `Sequence` per story inside long scenes, because `useCurrentFrame()` (and every kit component that uses it) reads the nearest Sequence's clock. Make both formats from the same components with `useV()` (height > width) switches for layout.

### 5. Design the sound
Build the score with `scripts/score.cjs` from a cue list: the spliced track plus synthesized UI sounds (typing per character, ticks on clicks, whooshes on camera moves, dings per toast, a hit with ducking on big moments). Every visible event gets a sound, and big moments get silence-then-hit. See `references/music-and-sound.md`.

### 6. Check like a viewer, then render
After every substantial change render contact sheets with `scripts/contact-sheet.mjs` (frames in ascending order; one sheet at a time, it uses a fixed debug port) for **both** formats and look for the failures in `references/polish-checklist.md` § Before you render: overlapping text, cropped cards, labels off-frame, mirrored edges, empty halves in 9:16, captions over UI, wrong timing. Fix, re-check, then render:

```bash
npx remotion render <Comp> out/<name>.mp4 --codec=h264 --crf=21 --audio-codec=aac --audio-bitrate=224k --pixel-format=yuv420p --color-space=bt709
```

Probe the result (frame count, duration, audio stream) before handing it over, and say plainly what you did not check (for example that you never listened to the mix).

## References

- `references/patterns.md` — what premium SaaS ads show, how they transition, why they feel cinematic (with timestamps from the reference ads).
- `references/polish-checklist.md` — every correction the user made, as rules, plus the pre-render checklist.
- `references/scene-recipes.md` — code-level recipes for each beat, using the kit.
- `references/music-and-sound.md` — choosing, analysing and splicing music; the sound-design vocabulary.
- `references/capture-ui.md` — capturing plates and element rects, privacy.
- `references/remotion-gotchas.md` — 3D, filters and timing traps that cost real time.

## Kit and scripts

- `assets/kit/` — `brand.ts`, `motion.tsx` (easing, keyframe tracks, kinetic type), `stage.tsx` (backdrops, horizon, 3D space, plates, page camera), `ui.tsx` (cards, glass, chips, hand cursor, check ring, confetti, logo tile, orb, toast, comet, whip/punch/pulse).
- `scripts/capture-plates.mjs` — high-DPR screenshots + element rects → `public/plates`, `src/plates.ts`.
- `scripts/analyze-music.cjs` — tempo, beat phase, loudness per second, section edges.
- `scripts/score.cjs` — splice the track, synthesize the sound-design cues, mix, normalize to WAV.
- `scripts/contact-sheet.mjs` — render chosen frames and tile them into one labelled image.
