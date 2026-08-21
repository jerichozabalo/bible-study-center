---
issue: 2
title: Groups + curriculum seed (create BGroup with schedule and current book)
status: done
blocked-by: [1]
type: afk
---

# Groups + curriculum seed

## Goal
Program/Book/Session tables seeded with the real GLC curriculum; Group CRUD with weekly schedule (day + time + duration) and current book; the Groups segment of the People tab lists groups; GroupDetail shows a group's schedule, book, and archive control. Creating "BGroup Linggo, Sundays 4pm, Book 1" is possible end-to-end on the deployed app.

## Scope
- "As the leader, I create BGroups with a weekly schedule (day + time + duration) and a current book…"
- Archive (never delete) with bulk-move offer; archived groups can't be picked anywhere (#27/#60).

## Notes
- Schema: `Program` (id, name, order) — seeded GLC 1 + GLC 2, **no create-program UI** (#33). `Book` points at Program. `Session` under Book. Seed **exactly** from `/home/jericho/glc-books/GLC-SESSIONS.md` — 8 books, 50 sessions, published titles verbatim (GLC 1 = Books 1–4, 20 sessions; GLC 2 = Books 5–8, 30 sessions). ⛔ Do not seed from artboard mock data (boards invent "Book 3 — Christian Beliefs"; real Book 3 is The Holy Spirit, 4 sessions).
- `Group`: schedule (day + time + duration, #36/#48 — ONE recurrence per group), current_book (#17 — the GROUP carries the book, no enrollment entity #16), archived flag, `owner_id` stamped (always Jericho, #32 — not a permission system).
- Archiving offers bulk move of members to another group (#27). Groups are never deleted.
- Vocabulary: **BGroup (Belong Group)**, never DGroup — except CCF's printed titles quoted as published ("Book 5: DGroup 101") (#66). English UI.
- The People tab's People/Groups **segmented control** (#62) is built here (People segment may be an empty state until issue 3 lands).
- Tests: server-action/query boundary against a test Postgres DB; TDD red first. Seed test asserts 8 books / 50 sessions and spot-checks titles against GLC-SESSIONS.md.
- Normative on any gap: `/home/jericho/biblestudy-tracker/DESIGN-CONCEPT.md`.

## Looks like
- `/home/jericho/biblestudy-tracker/design/Groups.dc.html` and `/home/jericho/biblestudy-tracker/design/GroupDetail.dc.html`.
- ⚠️ These boards predate #62: they show no tab bar, and Groups was its own tab. The decision wins — Groups renders inside the People tab's segmented control, and any full-width bottom CTA must not fight the tab bar. Boards still govern card layout, spacing, palette, copy tone.
- Render: `node /home/jericho/biblestudy-tracker/design/preview/build.js Groups '[{}]'`. A human must compare before this is called done.
