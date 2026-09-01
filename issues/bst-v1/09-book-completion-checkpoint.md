---
issue: 9
title: Strict book completion + advance checkpoint + progress dots
status: done
blocked-by: [6]
type: afk
---

# Strict book completion + advance checkpoint

## Goal
Per-person book progress is visible as dot rows on Person and GroupDetail (wrapping at 6 per row); a book is complete only when ALL its sessions are done; finishing a book prompts Jericho to confirm the group's next book through a checkpoint that lists left-behind members.

## Scope
- "As the leader, when a group finishes a book I get a checkpoint listing left-behind members before confirming the next book…"
- Strict completion (#5); book-completion prompt (#4); progress display (#68).

## Notes
- **Strict** (#5): a book is complete only when ALL its sessions have Completion rows with that session for that person. No credited/override sessions, no partial credit. NULL-session rows (#65) credit nothing.
- Advance (#17/#18): the GROUP carries the current book; advancing shows a checkpoint listing members who haven't completed the outgoing book → they land on the catch-up path (issue 7's matching serves them afterward). Silent advance was rejected. Book completion **prompts Jericho to confirm** the next book (#4) — never auto-enrolls.
- Mid-book joiners (#28): genuinely behind, joined-at marker shown so the left-behind list stays readable.
- **Progress dots wrap at 6 per row** (#68). ⚠️ Load-bearing and untested visually: Book 7 has 8 sessions, Book 8 has 12 — **no artboard ever renders more than 6**. The layout must hold at 390px with 12 dots (two rows of 6), large targets per #30. Test the rendering logic with Book 8 fixtures.
- Order of sessions is NOT enforced (progress = a set of completions, ride-alongs allowed); completion is per person, never per group (#2).
- Tests: fixture-driven, server boundary, test Postgres, TDD red first. Explicit PRD case: strict completion including a 12-session book; checkpoint lists exactly the incomplete members; confirm-next-book updates the group and nothing else.
- Normative on any gap: `/home/jericho/biblestudy-tracker/DESIGN-CONCEPT.md`.

## Looks like
- `/home/jericho/biblestudy-tracker/design/Person.dc.html` (progress rows) and `/home/jericho/biblestudy-tracker/design/GroupDetail.dc.html` (group progress dots).
- ⚠️ Boards show 6-session books only — the build must satisfy #68 (wrap at 6) with no visual reference showing it; keep the boards' dot styling, extend to a second row.
- Render: `node /home/jericho/biblestudy-tracker/design/preview/build.js Person '[{}]'`. Human comparison required before done.
