# Patterns from premium SaaS ads

Distilled from a frame-by-frame study (8 fps around every transition) of eight ads: NeuraFlow, LangEase, iBanFirst (iBanPay), Numtera (Zelios / ObiN Studio), Sber, PING's "cinematic interface", Spotify and Yonomi motion breakdowns. Timestamps are `(ad – seconds)`.

## Contents
1. The single biggest difference: they almost never cut
2. What they show
3. How they transition (catalogue)
4. Why it feels cinematic
5. Typography
6. Pacing
7. Studying new references

## 1. They almost never cut

Hard-cut counts (ffmpeg scene detection): NeuraFlow 0, LangEase 0, PING 0, Yonomi 0, Sber 2 in 13 s, iBanFirst 3 in 48 s, Numtera 10 in 95 s. The whole ad is one camera: an object in one scene becomes the stage or protagonist of the next. A video built from 15 hard cuts with punch-ins reads as a fast slideshow, however polished each slide is. Use hard cuts only as accents (a chorus, a whip).

## 2. What they show

- **One detail, not the whole screen.** A single button ("New mail"), one row ("DRAFT"), one card, isolated and enlarged; the rest removed or blurred.
- **Real UI first, then the UI leaves the screen.** Rows detach, cards lift, panels explode into layers with depth (Sber 2.0–3.5, NeuraFlow 3.5–4.5).
- **Type is a lead actor** (≈40% of runtime in Numtera and iBanFirst): 2–5 words at a time, centred, lots of air.
- **A recurring character** guides the eye: a glass orb (Sber), the brand star (NeuraFlow, LangEase, iBanFirst). It taps UI, flies between scenes and finally *becomes* the logo.
- **Visible outcomes**: "Payment approved", a check ring, confetti, a counter that reaches its total.
- **Problem before solution**: typed questions ("Still manually entering payment details?") over floating clutter.
- **Contrasting stages**: dark UI scenes alternate with light type/stage scenes; the background colour drifts rather than cuts.

## 3. Transition catalogue (best first)

1. **Object hand-off** — an element becomes the next scene: a folder icon between words drops into the upload area (LangEase 4.3–5.1); a "Payment approved" pill shrinks into a loader ring, then a check (iBanFirst 37.9–38.3); a blue strip inside a phone stretches like taffy into a progress bar (LangEase 9.9–10.9); the word "{ learning }" grows into a "learning…" bar (Numtera 30.9–31.5).
2. **Macro then pull back** — only the "New mail" button, a bloom opens, pull back to the whole mail app (iBanFirst 9.7–11.0). Reverse: push into one dashboard row and let everything else fall away (iBanFirst 28.5–28.8).
3. **Zoom through a letter** — dive into the bowl of an "o" until its ink fills the frame, out the other side into the next scene (Numtera 7.6–8.0, 54.8–55.0).
4. **Logo matte** — a huge brand shape containing the old scene shrinks into the logo (NeuraFlow 16.3–17.5); outline strokes of the logo sweep and converge (iBanFirst 42.3–43.8).
5. **Frame becomes an object** — the whole dark frame shrinks into a card on a light background (iBanFirst 39.8–40.2). Changes light/dark without a cut.
6. **Object fills the lens** — a glass bubble rolls into the camera and we see the next scene through it (Sber 11.9–12.2); a white bloom (NeuraFlow 6.9).
7. **Edge-on flip** — a card turns to a sliver and comes back with new content (Sber 0.7–1.0); one card flips and multiplies into many (LangEase 18.2–18.6).
8. **Rack focus instead of fade** — old scene defocuses, new one focuses (iBanFirst 19.5–19.9, Numtera 39.6, 49.3).
9. **Whip pan with directional blur** (iBanFirst 5.3, LangEase 20.0).
10. **Words leave one by one**, keeping the keyword, which then becomes UI (Numtera 30.5–31.2).
11. **Rise from a glowing horizon** — the dashboard climbs from behind a planet rim; the rim becomes its top edge (NeuraFlow 0.8–1.3).

## 4. Why it feels cinematic

- **The camera never stops**: slow push, pull or orbit with inertia; layers in front and behind; far layers soft.
- **Light**: rim light on glass edges, a top light cone, a glowing horizon arc, a reflection sweeping across glass (Numtera 22.4), bloom.
- **Directional motion blur** on fast moves, not uniform blur.
- **Uneven rhythm**: 3–4-frame whips between 1–2 s holds; strong ease-out (fast start, long settle), almost no bounce.
- **Restraint**: near-solid backgrounds with one drifting gradient blob; one brand hue plus one success colour.

## 5. Typography

- Clean geometric sans, regular/medium weight, slight negative tracking.
- Words arrive one by one out of a defocus blur and keep drifting a little.
- Keyword in the brand gradient; brackets or braces as emphasis ("[ Reusable knowledge ]", "{ learning }").
- **Scale snap**: a word arrives huge and blurred and settles small and sharp; tracking collapses ("They close tickets").
- Inline object between words: "Any language [folder] Instantly".
- Slot-machine word roll for lists ("Spotify got songs / audiobooks / podcasts / everything").

## 6. Pacing

- One idea per 1.5–3 s; text → UI → text.
- Hook 3–6 s, then the brand reveal on the music's entrance.
- Logo hold 2–3 s; the final musical hit lands on the logo or URL.

## 7. Studying new references

1. Download and sample with the `watch` skill (local engine is fine).
2. Detect hard cuts: `ffmpeg -i v.mp4 -vf "select='gt(scene,0.28)',showinfo" -f null -` and read `pts_time`.
3. For each transition window, extract 8 fps frames (`ffmpeg -ss A -t D -vf fps=8,scale=300:-2`) and tile them with timestamps; read the sheets. Motion at 2–3 fps is guesswork; at 8 fps you can see what morphs into what.
4. Write down for each transition: what object carries over, where the camera goes, what light or blur hides the seam.
