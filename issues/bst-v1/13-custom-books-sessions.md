---
issue: 13
title: User-created books and sessions
status: open
blocked-by: [2]
type: afk
---

# User-created books and sessions

## Goal
Jericho can create his own book with its own ordered sessions, and a group can adopt it as its current book — the app outlives the GLC curriculum.

## Scope
- "As the leader, I can add my own books and sessions beyond the GLC seed…" (#22).

## Notes
- Create book (name) + its sessions (ordered titles); editable until a group has held meetings against it, tombstoned corrections after (#24). A user-created book belongs to **no program** in v1 — programs are seeded-only, no create-program UI (#33); v1.1 makes programs user-creatable (out of this issue's scope, don't build hooks beyond what #33 already put in the schema).
- User-created books behave identically downstream: group current-book (#17), prefill (#53), strict completion (#5), catch-up matching (#31), progress dots wrapping at 6 (#68) — a 12-session custom book must render.
- No import/share-a-program feature — explicitly closed in the v1.1 backlog notes.
- Entry point: no artboard covers this surface. Put creation where the curriculum is encountered (the book picker on group create/edit — "Add your own book" at the end of the list) and follow the Groups/NewMeeting form idiom. Flag the placement for human review in the session report.
- Tests: server boundary, test Postgres, TDD red first. Cover: created book selectable as a group's current book; sessions ordered; completion/prefill logic runs against it unchanged.
- Normative on any gap: `/home/jericho/biblestudy-tracker/DESIGN-CONCEPT.md`.
