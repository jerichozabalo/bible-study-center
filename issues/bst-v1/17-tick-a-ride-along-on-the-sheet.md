---
issue: 17
title: Record a ride-along on the attendance sheet
status: done
blocked-by: [7]
type: afk
---

# Record a ride-along on the attendance sheet

## Goal
When someone from another BGroup actually shows up to a meeting, the leader can
tick them on that meeting's sheet as a guest — without creating a duplicate
roster record for a person who already exists.

## QA follow-up (2026-09-04)
Browser QA of the sheet passed the online paths (catch-up section inside the
form, "Add to tonight", the ride-along search / "SOMEONE NEW" split, ticks
surviving an add) but found one defect: **offline, the ride-along "Add" and
walk-in "Save to the roster" buttons were unguarded submits** — `handleSubmit`
`return`ed for them without `preventDefault`, so offline they POSTed anyway, the
server action threw `Failed to fetch` uncaught, and the whole sheet (every
unsaved tick) was replaced by the framework error page. Fixed: `AttendanceSheet`
now tracks `navigator.onLine`, those buttons are `disabled` offline, the add
card and the catch-up list show "Adding someone needs a connection. The ticks
above still save on this phone.", and `handleSubmit` `preventDefault`s the
online-only submits as a backstop. Still code-`done`; the fix wants Jericho's
phone pass alongside the rest of 17.

## Scope
- "As the leader, on a meeting's attendance screen I can add a person who is
  already on my roster (from another BGroup) to tonight's sheet and mark them,
  and it records as a guest visit (#31) — the completion credits them, the host
  group's history shows the visit, their home group's counts are unchanged."

## Notes
- **Why this exists (discovered during issue 7, 2026-09-01):** issue 7 delivered
  the catch-up *list* — who from another BGroup is missing tonight's session —
  and derives the guest marker on anyone who already has a completion for the
  meeting. But there is no path to *create* that completion for an existing
  person. `getSheet` returns only `roster ∪ people-with-an-existing-completion`
  for the meeting, and the sheet's only mid-meeting add is `addWalkIn`, which
  calls `createPerson` — so a real ride-along either cannot be ticked or becomes
  a second roster row for someone already on the roster. This is the exact
  outcome issue 7 was meant to make possible.
- The catch-up cards (`src/components/attendance/CatchUpList.tsx`) currently link
  out to `/people/[id]`. The natural fix is an "Add to tonight" affordance —
  from a catch-up card, and/or a person search behind the sheet's existing
  "Add someone else" card (which today only does the walk-in path).
- Guest derivation already exists: `SheetPerson.guest` and `getSheet` handle a
  person whose `home_group_id != meeting.group_id`. This issue only needs to get
  such a person *onto* the sheet and let `recordSheet` write the mark — the
  counting rules (#31) already fall out of the completion + the derived marker.
- `recordSheet`'s `assertOnRoster` already accepts any of the leader's people
  (removed included), so an existing person from another BGroup passes. The gap
  is purely the sheet's read + the UI to pick them.
- Vocabulary: **CATCH-UP** / ride-along, never "BEHIND" (#66). Leader UI English.
- No invite draft/send — that is v1.1.
- Tests: server boundary, test Postgres, TDD red first. Fixture: a person whose
  home group is not the meeting's, added to the sheet and marked; assert the
  completion credits the person, `getSheet` now returns them with `guest: true`,
  `listCompletions` on the host meeting shows them, and no duplicate person row
  was created.
- Normative on any gap: `/home/jericho/biblestudy-tracker/DESIGN-CONCEPT.md`.

## Looks like
- `/home/jericho/biblestudy-tracker/design/Attendance.dc.html` — no board draws
  this (the boards predate #31). Build in the established sheet idiom; the
  existing "Add someone else" card and the issue-7 catch-up cards are the
  patterns to extend.
- Render: `node /home/jericho/biblestudy-tracker/design/preview/build.js Attendance '[{}]'`.
  Human comparison required before done.
