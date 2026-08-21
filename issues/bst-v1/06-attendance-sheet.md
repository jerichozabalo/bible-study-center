---
issue: 6
title: Attendance sheet (tick model, present-only, walk-in capture)
status: done
blocked-by: [3, 4]
type: afk
---

# Attendance sheet

## Goal
Opening a meeting shows its attendance sheet: the group's roster with one-tick marking, a "present only" option, walk-in capture by name alone, and confirming the sheet marks the meeting HELD. Completions are recorded per person; edits and backdating tombstone.

## Scope
- "As the leader, I take attendance on my phone with one tick = attended + completed, a 'present only' option, and name-only walk-in capture…"
- Meeting proposed → held transition happens here as the deliberate act (#47); attendance at a no-session meeting still counts as contact (#26).

## Notes
- `Completion` schema (#65): one row per (person, meeting) — **unique on (person, meeting)** — with `session` **nullable**: a row with a session = that person covered it; NULL session = present at a no-session meeting, **credits nothing** toward any book. Plus the attended|present-only distinction (#25). `owner_id` stamped (#32).
- One tick = attended + completed the meeting's session; "present only" records presence without completion (#25). If the meeting has no session (fellowship night), every tick writes a NULL-session row — the sheet's copy already promises "everyone you tick still counts as contact".
- Walk-in (#25/#67): add a new person from the sheet with **name alone** — uses issue 3's name-only save; the person stays flagged incomplete until a contact detail lands. Their home group defaults to the meeting's group.
- Free editing + backdating; corrections tombstone, nothing truly erased (#24). Reopening a held meeting's sheet to fix a tick is legal and tombstones the correction.
- Vocabulary: sheet rows for visitors will render as guests in issue 7 — leave the seam; "CATCH-UP" never "BEHIND" (#66). English UI.
- Tests: server boundary, test Postgres, TDD red first. Cover: uniqueness on (person, meeting); NULL-session rows credit no book progress; present-only vs attended; walk-in name-only save + incomplete flag; held transition; tombstoned correction.
- ⚠️ **Inherited from issue 3 (added 2026-08-21).** Issue 3's scope claimed a
  fixture proving **"transfer preserves completions" (#27)** and could not build
  one — there was no `completions` table yet, so it asserted the mechanism
  instead and the guarantee is **unproven**. This issue creates that table, so
  the fixture belongs here: move a person to another BGroup and assert their
  existing completion rows are untouched — same rows, same sessions, same
  meetings. Add it to the list above; it is not optional.
- Normative on any gap: `/home/jericho/biblestudy-tracker/DESIGN-CONCEPT.md`.

## Looks like
- `/home/jericho/biblestudy-tracker/design/Attendance.dc.html` — governs the sheet, including the "Guest (unsaved) — tap to name and save as a member" affordance and lesson-off copy.
- Render: `node /home/jericho/biblestudy-tracker/design/preview/build.js Attendance '[{}]'`. Human comparison required before done.
