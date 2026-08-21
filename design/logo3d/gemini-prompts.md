# Gemini prompts — Bible Study Tayo retro-ink logo

Upload `out/retro/ref-take1.png` (and/or `ref-take3.png`) as the reference.
Do NOT upload the watermarked Alamy image.

---

## A · Style exploration — find the look

> Create a logo mark in the style of 1950s American pen-and-ink advertising
> clip art — the bold black-and-white newspaper-ad illustration style with
> heavy solid black masses and sharp tapered white knockout strokes carving
> into the forms.
>
> Subject: two people side by side reading and discussing an open Bible
> together. One is clearly older and larger — a mentor. The other is smaller
> and younger — the one being taught. They are leaning toward each other over
> the book, mid-conversation, not posing.
>
> Style rules, strictly: pure black and white only. No gray, no halftone dots,
> no gradients, no shading, no cross-hatching. No outlines around shapes —
> forms separate by thick white gaps. Line weight varies; strokes taper to a
> point. Hand-inked, slightly irregular, confident.
>
> Composition: single centered subject on a plain white background. Square
> format. No text, no lettering, no border, no watermark, no drop shadow.
>
> Give me 4 different compositions.

---

## A2 · CORRECTED — adults, no age gap  ← use this one

The first version said "older / younger / being taught" and Gemini drew an old
man reading a story to a boy. Age words are the bug. Both readers are adults;
the leader role shows in the GESTURE, never in the size.

> Create a logo mark in the style of 1950s American pen-and-ink advertising
> clip art — bold black-and-white newspaper-ad illustration with heavy solid
> black masses and sharp tapered white knockout strokes carving into the forms.
>
> Subject: two adults of the SAME AGE sitting side by side, both looking down
> at one open Bible between them, in the middle of a discussion. One is
> speaking and gesturing at the page; the other is listening and following
> along. They are peers — same age, same size, same build. This is an adult
> small-group Bible study between equals.
>
> Absolutely not: no children, no boys, no teenagers, no elderly person, no
> grandfather, no age difference of any kind, no one being read to, no
> storytelling, no teacher-and-pupil, no classroom.
>
> Style rules, strictly: pure black and white only. No gray, no halftone dots,
> no gradients. No etching, no engraving lines, no hatching, no cross-hatching,
> no stippling, no line shading on faces or hair — hair and clothing are solid
> black masses broken only by thick white gaps. No outlines around shapes.
> Line weight varies; strokes taper to a point. Hand-inked, slightly irregular.
>
> Composition: waist-up, single centered subject, plain white background,
> square. No text, no lettering, no border, no watermark, no drop shadow.
>
> Give me 4 different compositions.

**Run it twice** — once "two adult men", once "two adult women" — depending on
who the app is for. CCF discipleship groups are usually same-gender.

**If it still drifts to a child:** delete the roles entirely. Say "two adults
reading the same open Bible together" and nothing about who leads. Add the
leader read back later in the vector rebuild, where it is one number.

---

## B · Tight mark — for the app icon

Same as A, but swap the composition paragraph for:

> Composition: an extremely simplified emblem, not an illustration. Six or
> fewer distinct black shapes total. Readable as a solid silhouette at
> 16 pixels. No facial features, no fingers, no small details of any kind.
> Centered, square, plain white background, no text.

---

## C · Redraw mine — style transfer

Upload `ref-take1.png`, then:

> Redraw the attached logo in the style of 1950s pen-and-ink advertising clip
> art. Keep the exact composition, proportions and silhouette — the larger
> reader on the left, the smaller reader on the right, the open book across
> the bottom. Change only the drawing quality: make the edges hand-inked and
> slightly irregular, add sharp tapered white knockout strokes carving into
> the black masses to suggest hair and cloth folds. Pure black and white,
> no gray, no gradients, no outlines, no text. Square, plain white background.

---

## If output goes wrong

| Problem | Add to the prompt |
|---|---|
| Grays / soft shading appear | "1-bit black and white only, like a fax or a photocopy" |
| Halftone dots | "no halftone, no dot screen, no newsprint texture" |
| Faces get detailed | "faceless silhouettes, no eyes, no mouths" |
| Adds lettering | "no text, no letters, no words, no signature" |
| Too busy for an icon | "fewer shapes, bolder, simpler — an emblem not an illustration" |
| Looks like modern flat vector | "hand-inked with a brush, irregular edges, 1955 newspaper ad" |
| Draws a child | "both are adults the same age" + list every age word as a negative |
| Etching / hatching on faces | "no engraving lines, no hatching, no stippling — solid black masses only" |
| Reads as storytelling | "a discussion between equals, both looking at the page, neither being read to" |

## After Gemini

Pick a winner and bring the PNG back here. I rebuild it as clean two-colour
SVG with a real 16px twin — same as `retro.js`. The Gemini output is the
sketch, not the deliverable.
