# Scene recipes

Code-level recipes for each beat, using `src/kit` (`brand.ts`, `motion.tsx`, `stage.tsx`, `ui.tsx`). Frames assume 30 fps and a 120 BPM track (15 frames per beat). Every number is a starting point that worked; retime to your track.

## Contents
- A. Composition skeleton
- B. Hook with a letter dive
- C. Meet on the horizon
- D. Rise, wall, fly into a page
- E. Page camera: sidebar navigation, page swap, macro, lift
- F. Pop-out flip card that reaches everyone, then goes home
- G. Rows fly into "done" and the list closes up
- H. A question that gets answered
- I. Light-stage quick pass (fan + search filter; cascading cards)
- J. Notification burst on the chorus
- K. Glass phone
- L. Promise and logo

## A. Composition skeleton
```tsx
export const CUTS = {meet: 120, rise: 240, stories: 420, notify: 1080, phone: 1230, promise: 1440, logo: 1560, end: 1680};
// One Sequence per scene; Pulse wraps them all; scenes reached by a hard cut get <Punch>.
<AbsoluteFill style={{background: K.night}}>
  <Audio src={staticFile('audio/score.wav')} />
  <Pulse from={CUTS.meet} to={CUTS.end - 55}>{scenes.map(...<Sequence from to>...)}</Pulse>
  <Comet from={CUTS.logo - 26} to={CUTS.logo} size={160} path={...ends at the logo tile position, scale 0.35→1.4} />
</AbsoluteFill>
```
Register both `1920x1080` and `1080x1920` compositions with the same component. Inside long scenes, give each story its own nested `Sequence` (see gotchas).

## B. Hook with a letter dive (0–120)
- Floating chat bubbles (glass, generic grey avatar dots, short real-sounding questions) pop in two by two, drift up slowly, far ones blurred.
- Three typed questions, each ≈30 frames: `<Typed cpf={1.5} />`, exit 6 frames up with blur. The last one paints its tail with `hiFrom`.
- Dive: measure a letter with a canvas (see gotchas), then on the last line `transform: scale(exp(ln(120) * p²))` with `transformOrigin` at that point, p over frames 90→118; fade an ink layer (the next scene's background colour) over 110→118. The bubbles blur and fade as the dive starts.

## C. Meet on the horizon (120–240)
- Dark `Backdrop` with `beam`; `Planet` rising from below (`top = PLANET_TOP + (1 - rise) * 40`).
- A huge word ("Meet") blurs in over 9 frames, scale 1.3→1, blurs out at 22–30.
- Logo tile flips in (`rotateY(100→0)`), the product name with `<Words>` beside it; a glass pill below types the promise (`cpf 1.9`).
- Exit: lift the content up and blur it, **leave the planet where it is** so the next scene continues from the same horizon.

## D. Rise, wall, fly into a page (240–420)
- World group in a `Space`; tiles are page plates at world positions (dashboard at 0,0; other pages at ±1750 x, ±1080 y).
- Camera keys `{t, cx, cy, s, rx, ry, rz, y}`: start low and steep (`y 1100, rx 56`), rise to `rx 28` by 40, hold while the dashboard's top cards lift (`translateZ(170 + i*26)` with glow, staggered 4 frames), pull back to `s 0.42` with a small yaw to reveal the wall (other tiles fade in), then fly to the first story's page so it ends flat and centred at the page-camera start zoom. Blur the group in proportion to camera speed.
- Draw the `Planet` after the group and push its `top` down (+70% over 60 frames) so the dashboard climbs out from behind the horizon.
- A giant, faint wordmark behind the wall (`translateZ(-900)`, alpha 0.13) adds depth.

## E. Page camera (stories in the real UI)
```tsx
const c = track(f, CAM); // {t, cx, cy, z, rx, ry} in page coordinates
<PageCam c={c} fit={frameWidth / pageWidth}>
  <PlateCrop plate={PLATES.desktop.tasks} r={{x: 0, y: 0, w: 1600, h: 900}} style={{boxShadow: RIM}} />
  ...overlays in page coordinates...
  <div style={{transform: 'translateZ(110px)'}}><Hand x={h.x} y={h.y} press={[...]} size={84 / zoom} /></div>
</PageCam>
```
- **Navigation**: move the hand to the sidebar item, press, then 1 frame later swap: draw the new plate clipped to the main area (`clipPath: inset(64px 0 0 240px)`) sliding from `translateX(90px)` over 9 frames, plus a diagonal light sweep across the page. The sidebar's active item changes with the new plate.
- **Macro and lift**: push the camera to the card (z 1.7–1.9, small rx/ry), ring it in the accent colour, lift a crop of it with `translateZ(70)` and a glow, add one meaningful chip in an empty corner (check the plate for existing badges first).
- **End wide**: before leaving, pull back to `z ≈ 1` so the whole page is visible, fade the vignette, then whip out.
- Vertical: smaller macro zoom so the whole card fits the width; caption band at the bottom.

## F. Pop-out flip card (hero story 1)
- Hand clicks a cell; compute the cell's screen position from the camera at that frame; a 2× card (front face = the cell crop scaled 2, back face = a designed detail card) flies from there to a stage position while the page dims and blurs, and flips (`rotateY 0→180`, `backfaceVisibility: hidden`).
- Show the consequence as an object: a seating plan (6×5 rounded seats with generic person icons) where each seat lights up as a small glowing particle travels from the card; a counter "Notified 30/30".
- Then **go home**: hide the seats, flip back, fly to the cell's *current* screen position, un-dim the page, ring the cell briefly, whip out.

## G. Rows into "done", the list closes up
- A "Done 12" box appears in an empty header area of the page.
- Hand ticks a row: a `TickDot` and strike on that row's crop; the crop flies along an arc (`translateZ(sin(p·π)·220)`, scale →0.22) into the box, the counter increments as it lands.
- Reflow: from the first flight on, cover the list area with the list background and redraw the remaining row crops shifted up by `rowHeight × closed` (ease over 12 frames per removed row). Never leave an empty slot.

## H. A question that gets answered
- One large dark-glass bubble: anonymous avatar, the question typed in, an "Anonymous" switch the hand turns on, a send button.
- On send the bubble rises; three reply bubbles **pop in place** (scale 0.6→1, rise 50 px) with generic avatars; the upvote chip counts 0→12; a "Solved" chip pops last.

## I. Light-stage quick pass
- **Resources**: light `Backdrop`, a heading that exits up, then a glass search pill that types the query and shows "1 result". Four dark cards fan in 3D (`rotate k·6°`, `rotateX 8°`, slow bob). On filter, the match moves to centre, scales 1.3 with a brand ring and glow; the others fall, blur and fade. Caption "Resources: search and find."
- **Progress**: a big question ("Missed a class?") that shrinks to the top; subject cards cascade down with `rotateX(50→0)` in a 2×2 grid (1×4 vertical), each with a pulsing "Live" chip; the first card gets a ring. Then rush out (scale up, blur) into the next scene.

## J. Notification burst (on the chorus)
- Bell tile centre (top in 9:16), toasts on the beat (every 15 frames): in 16:9 they fly from the bell to two columns; in 9:16 they slide in from the sides into a stack so they never cross each other. Each pop sends a ring wave from the bell and bumps a red badge counter.
- Exit: toasts get sucked into the bell, the bell scales ×18 and whitens into a light stage.

## K. Glass phone
- Phone body = 3 stacked rounded slabs at `translateZ(-5·d)` + the mobile plate as screen + a diagonal gloss layer. Tilt `rotateY -20°, rotateX 10°` and drift.
- Blocks of one screen lift as layers (`translateZ(46 + i·12)`), an `Orb` travels between them and taps; layers settle before the end.
- Exit: a screen-space orb grows to fill the lens and the frame whitens.

## L. Promise and logo
- Three lines, one every two beats: muted first word ("Never"), brand keyword at the end. Fold into the centre (scale 0.5, blur) at the end.
- Logo: the comet tile arrives at the tile position; wordmark and tagline; the URL pill (glass, light sweep) on the final musical hit; hold 1–2 s; fade slightly at the very end.
