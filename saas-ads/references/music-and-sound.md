# Music and sound

## Choosing the track
- Premium SaaS ads use clean, bright electronic or corporate-pop with a steady pulse (110–130 BPM). A cinematic trailer track fights the calm UI; the user rejected one.
- Offer 3–4 candidates on a small HTML listening page (`<audio controls src=...>` per track, with genre, BPM and where the entrance is), then ask. Mixkit tracks need no attribution (Mixkit Free License). Download only what the user picks.
- Good structure: a quiet intro (hook), a clear entrance (brand reveal), a fuller section (stories), a chorus or lift (the notification burst), and a clean final hit with a short decay (logo/URL).

## Analysing
`node scripts/analyze-music.cjs track.mp3` prints duration, tempo candidates, the best beat period and phase (seconds of the first beat), loudness per second and likely section edges (big jumps in loudness). Confirm the entrance and the last hit by printing quarter-second loudness around them (`--around 16,96`).

## Splicing onto the video
Map video time to track time with segments `[videoStart, videoEnd, trackStart]`:
- Start the excerpt so that the entrance lands on the brand reveal (e.g. video 4 s → track 16.132 s means the first segment starts at track 12.132 s).
- Jump to the last chorus at a story boundary with a short crossfade, on a bar boundary in both places (bar = 4 beats).
- Choose the second segment's start so the track's final hit lands on the URL pill; then end the video ~2 s after it.
Cover the splice with a whoosh + hit so the ear accepts it.

## The sound-design vocabulary (`scripts/score.cjs`)
| Visual event | Cue |
|---|---|
| Typed text | `type` per character at the typing speed |
| Cursor click, toggle | `tick` + a short `blip` |
| Element pops in | `blip` (pitched up through a sequence), `paper` for cards |
| Camera move, whip | `whoosh` (direction via pan p0→p1, rising or falling f0→f1) |
| Build-up into a big moment | `riser` ending exactly on the moment |
| Big moment | `hit` (impact + ducking of the music) |
| Something lands | `thud` (+ `metal` for weight) |
| Success | `bell` pair or `ding`, `shimmer` for magic moments |
| Notification | `ding` per toast, notes climbing |
| Countdown/flip | `flap` clacks slowing down |

Mix: music ≈ 0.9, effects ≈ 0.55, light delay and reverb on bells and whooshes, soft-clip and normalize to −1 dBFS. Lift a very quiet intro so the hook is not near-silent. Every visible event should have a sound; most should be quiet.
