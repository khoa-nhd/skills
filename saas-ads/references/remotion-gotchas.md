# Remotion gotchas that cost real time

## Timing
- `useCurrentFrame()` returns the frame of the **nearest `Sequence`**. A story drawn inside a long scene with `f - 180` passed as a prop still runs its kit components (`Words`, `Typed`, `Hand` presses) on the parent clock, so captions appear at the wrong time or never. Wrap each sub-scene in its own `<Sequence from durationInFrames>` and read the frame inside it.
- Keyframes beat ad-hoc ramps for cameras and cursors: `track(f, [{t, cx, cy, z, rx, ry}, ...])` keeps moves continuous and easy to retime.
- Put cuts on the beat grid (`frames per beat = fps * 60 / BPM`, 15 at 30 fps / 120 BPM).

## 3D in CSS
- Camera transform order (outermost first): `rotateX(rx) rotateY(ry) scale(z) translate(-cx, -cy)` inside a container with `perspective`. Targets are page coordinates, so cursors and overlays placed in page coordinates follow the camera for free.
- `opacity` or `filter` on an element with `transform-style: preserve-3d` flattens it. Put opacity and filters on leaf elements, or on a wrapper *outside* the 3D container.
- Chrome sorts large planes badly (a ground plane drawn over tower bases). Render the ground in its own layer underneath.
- For flips use two faces with `backface-visibility: hidden`, the back face pre-rotated 180°.
- A cursor rendered inside a scaled group must be sized `84 / zoom` to stay constant on screen.

## Filters and blur
- **`backdrop-filter` mirrors content at its edges.** A depth-of-field overlay made with `backdrop-filter: blur()` and a radial mask produced doubled cursors and mirrored text at the frame edges. Use a dark radial vignette (no blur) whose opacity grows with zoom, or blur leaf layers directly.
- `filter: blur()` on a wrapper of a 3D scene is fine for motion blur (blur ∝ camera speed, capped around 9-10 px).

## Type
- `Words` wraps on spaces: a long title in a narrow column wraps and collides with the subtitle. Give titles `white-space: nowrap` (and `flex-wrap: nowrap`) or a wider column, and check 9:16.
- To dive into a specific letter, measure with a canvas: `ctx.font = '500 104px "Font"'`, `ctx.letterSpacing`, `measureText(prefix).width`, and the `o` bowl from `actualBoundingBoxAscent`. Then set `transform-origin` there and fade an ink-coloured layer in at the end so a few pixels of error never show.
- Load fonts with `@remotion/google-fonts` and pick one covering the caption language (Be Vietnam Pro for Vietnamese).

## Rendering and checking
- Contact sheets: render specific frames with `--frames=a,b,c` (Remotion writes them in ascending order, so list them ascending or labels will be misaligned).
- Two sheet scripts in parallel fight over the same Chrome debugging port; run them one after another.
- A Bash heredoc can choke on backticks and `${}` in TSX; write files with the editor tool, or splice text with a small Node script using `indexOf` instead of regex.
- Render command for social delivery: `--codec=h264 --crf=21 --audio-codec=aac --audio-bitrate=224k --pixel-format=yuv420p --color-space=bt709`. Probe the output with ffprobe for frame count, duration and an AAC stream.
- Changing the composition length means changing the score length, the splice points and the final-hit frame together.
