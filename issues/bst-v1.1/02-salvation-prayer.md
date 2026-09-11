---
issue: 2
title: Salvation prayer — a toggle (with date) on the person record
status: open
blocked-by: []
type: afk
---

# Salvation prayer

## Goal
A person's record gains a **prayed the salvation prayer** toggle, mirroring how
`baptized` already works: editable on the person form, shown on the person's
page.
⚠️ **PROPOSED, not yet answered:** it carries an optional date
(`prayed_salvation_on`), the way `baptized` carries `baptized_on`. Confirm or
drop at review — if dropped, the migration keeps the boolean only.

## Scope
- As Jericho, I mark that someone has prayed the salvation prayer, with the
  date it happened.
- Shows on the person's page beside the other milestones (Baptized), and in the
  create/edit form.

## Notes
- Repo `~/biblestudy-tracker`. Read first: `CLAUDE.md`, `DESIGN-CONCEPT.md`
  (#9b, #66), and how `baptized` / `baptized_on` are already done end to end.
- **Schema:** next free migration (**010** at writing time):
  `ADD COLUMN IF NOT EXISTS prayed_salvation boolean NOT NULL DEFAULT false` +
  `prayed_salvation_on date` (nullable). Mirror whatever `baptized_on`
  enforces — if it refuses future dates, this does too.
- Touch points, same shape as `baptized`: `migrations/`, `src/lib/roster/
  people.ts` (create/update + row type), `src/lib/roster/form.ts` (parse and
  validate), `src/components/people/PersonForm.tsx`, the person page
  (`src/app/(shell)/people/[id]/page.tsx`), and the **offline person-create
  payload** (`src/lib/outbox/pending.ts`) — same silent-replay trap as issue 1.
- Independent of `spiritual_status` (4E) and `baptized` — do not couple them or
  auto-set one from another.
- Tests at the server boundary, red first: create/update round-trip; the date
  rule; the person page renders it; the outbox payload round-trips.
- Loops before done: test / typecheck / lint / build. One commit referencing
  the issue; **do not push**.

## Looks like
- `design/Person.dc.html` (detail) and `design/People.dc.html` (form surface)
  govern. Same gate as issue 1: a new row inside a settled layout — Jericho's
  eyeball decides done. Render boards with
  `node design/preview/build.js Person '[{}]'` (props come from `DC_PROPS`).
