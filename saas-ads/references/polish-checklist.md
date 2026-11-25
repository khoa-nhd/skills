# Polish checklist

Every rule below is a correction a real user made while reviewing seven versions of a promo. They are the difference between "nice animation" and "an ad people watch to the end".

## Story

- **Pace that holds attention.** A version where every scene lasted 6–8 s was "too slow". Scenes of 2–5 s, cuts and pops on the beat, word stagger 2–3 frames, entrances ≈10 frames.
- **No feature twice.** One version showed Q&A five times (tour, a toast, the phone, its own scene, the closing promise). The user called it over-emphasised. Map every feature to exactly one beat before building; the closing promise may name it once more.
- **The phone is one idea.** Replaying the desktop tour on a phone "duplicates the idea". Show one screen with lifting layers and say "on your phone too".
- **A tour of screens gets boring.** "Only screens, then zoom into each one" was dull. Pick 2–3 hero stories with their own mechanic (pop-out flip card that notifies a seating plan; rows that fly into a "done" box while the list closes up; an anonymous question that gets answers), plus a quick pass for the rest.
- **Make the point readable.** An abstract metaphor (a desk calendar flipping to the exam date) was "not clear". Prefer the real UI showing the real thing (the exam card lifting off the exams page with a "3 days left" chip).
- **Show how you got there.** Entering a page should be visible: the hand clicks the sidebar item, the page slides in with a light sweep, the camera finds the card.
- **Keep the ending short.** A brand-outline sweep plus a long logo hold felt long. Promise + logo ≈ 7–8 s; shorten the video rather than pad it.
- **Caption pattern**: "Feature: benefit." in one consistent shape ("Tài liệu: tìm là thấy.", "Bài tập: xong là tick."). Avoid two captions that mean the same thing ("Everything in one place" then "Every page is here").

## Motion

- **Return before transitioning.** A card that popped out of the timetable must flip back and fly into its slot, and the page must come back into focus, before the next scene. Leaving it hanging felt broken.
- **Show the whole thing before leaving.** Cutting away while zoomed in on half a card "loses a piece". End each stop with the full card or page in frame.
- **Lists close up.** When a row leaves, the rows below slide up into its place; never leave an empty slot.
- **Reflow inside the real UI.** Cover the original area with the list's background colour and redraw the remaining row crops at their new positions.
- **Pop in place.** Elements that fly from a shared origin pass over each other mid-flight; pop them where they will rest (scale and fade up with a small rise).
- **The quick pass should look designed.** Montage-style icon tiles flashing a new background every beat look like a template. Light stage, dark cards in a 3D fan, a glass search pill that filters to one glowing result, subject cards cascading with a "live" dot: that looked good.

## Visual hygiene

- **No text overlap, ever.** The user notices every collision.
  - A chip placed in a card corner that already has a badge.
  - A caption over the bottom row of cards: move the camera so content sits above the caption band.
  - A label off-frame in 9:16.
  - A caption over the bottom of the phone.
  - Labels drawn on the back cards of a stack.
- **Measure real positions.** Before placing an overlay on a screenshot, look at the plate and convert coordinates; don't guess from rect names.
- **Match the product.** Checkboxes that are circles in the app must be circles in the overlay; sample colours from the plates.
- **Fill 9:16.** Vertical frames need bigger zoom on UI and layouts that use the height (caption at top or bottom, content centred). Check that nothing is cut at the edges and no half of the frame is empty.
- **Privacy**: no real names, emails or avatars; generic person icons for "the class"; teacher names only if the user accepts them.

## Before you render

Render contact sheets of both formats (frames listed in ascending order) and check:

- [ ] No overlapping text anywhere, including mid-animation frames of fly-ins.
- [ ] No cropped cards or labels at the frame edge, in 16:9 and 9:16.
- [ ] No mirrored copies or doubled cursors near edges (backdrop-filter, see gotchas).
- [ ] Each feature appears once; captions follow one pattern.
- [ ] Every transition: the element has returned or the whole subject is visible first.
- [ ] Sub-scenes have their own `Sequence` (captions and clicks happen when intended).
- [ ] Music: entrance on the brand reveal, chorus on the big burst, final hit on the URL.
- [ ] The rendered file has the expected frame count, duration and an audio stream.
