---
issue: 1
title: Nickname — a person is called by it everywhere, full name stays the record
status: done
blocked-by: []
type: afk
---

# Nickname

## Goal
A person gains an optional **nickname**. When it is set, the app shows it
**everywhere a person's name appears** — the person's own page included. The
full name stays the stored record. Creating (including the offline path) and
editing a person both carry it.

## Scope
- As Jericho, I add or edit a nickname on any person.
- Lists and sheets show the nickname when set, else the full name: roster,
  attendance sheet (rows, search, initials), catch-up cards, guest labels,
  reports (Person/Group/Roll-up), Home cards.
- **Amended 2026-09-11 (Jericho, on seeing it live) — settled after two rounds:**
  first the person's own page swapped to lead with the full name; then lists
  went full-name-first with the nickname in parentheses — **and that parenthetical
  was rejected on sight.** Final rule: **every list, sheet, report and card shows
  the full name only;** the nickname appears solely on the person's own page
  (its own line beneath the heading) and in the edit form. Avatar initials come
  from the full name; search still matches either; the offline replay still
  carries the nickname.
- Offline: a person created with no signal keeps its nickname through the
  outbox replay, and the pending row shows it.

## Notes
- **Repo: `~/biblestudy-tracker`.** Read first: `CLAUDE.md`,
  `DESIGN-CONCEPT.md` (#9b, #66), `issues/bst-v1/PRD.md`.
- **Schema:** new migration, next free number (**009** at writing time):
  `ALTER TABLE people ADD COLUMN IF NOT EXISTS nickname text;` — additive;
  never edit a migration that has run. Mirror the `name` field's validation
  (`src/lib/roster/people.ts` / `form.ts`): trim, non-empty when given, same
  length ceiling. NULL = not set. No uniqueness.
- **One display rule, one helper.** Put a `displayName(...)`-style helper where
  the roster types live and use it at every call site that currently prints
  `person.name` — roster rows, `src/components/attendance/AttendanceSheet.tsx`,
  `CatchUpList.tsx`, `src/lib/insights/reports.ts`, the person pages. Search
  must match nickname **or** name (the sheet's filter does
  `person.name.toLowerCase().includes(term)` today). The shared initials helper
  takes the display name.
- **Reports CSV:** keep `name` as the full name and add a `nickname` column —
  a CSV is closer to a record than a screen. *(Flagged at review; say if you
  want nickname-only.)*
- **Offline path (issue 18's outbox):** the person-create payload must carry
  `nickname` — `src/lib/outbox/pending.ts` (payload type + the person write)
  and the display in `PendingRosterRows`. A dropped field here fails silently
  on replay.
- Tests at the server boundary, red first: create/update round-trip with and
  without a nickname; every read path falls back to `name`; search matches
  either; the outbox payload round-trips.
- Loops before done: `npm run test`, `npm run typecheck`, `npm run lint`,
  `npm run build`. One commit referencing the issue; **do not push**.
- ⛔ `next dev` OOMs this VM — `npm run build && npx next start -p 3111` to
  look at it. Deploy is a separate, deliberate step (CLAUDE.md).

## Looks like
- `design/People.dc.html` and `design/Person.dc.html` govern the roster and
  the person page; `design/Attendance.dc.html` governs the sheet. Render with
  `node design/preview/build.js <Board> '[{}]'` — ⚠️ board *props* come from
  the `DC_PROPS` env var, the JSON argument is component state.
- No board shows a nickname — it is new text inside settled layouts. Done
  requires Jericho comparing the built screens against the boards; green tests
  are not evidence of a visual match.
