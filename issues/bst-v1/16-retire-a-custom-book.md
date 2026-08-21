---
issue: 16
title: Retire a custom book (creating one is currently a one-way door)
status: open
blocked-by: [13]
type: afk
---

# Retire a custom book

## Goal
A custom book created by mistake can be taken out of the book picker from
`/books`, without touching any group that already adopted it or any progress
recorded against it.

## Why this exists
Discovered while supervising issue 13 (2026-08-21), not planned.

Issue 13 built creation and session editing for custom books (#22) and scoped
removal out. The result is the same shape of trap issue 14 fixed for BGroups:
`books` has no `retired_at` (only `sessions` got one, in
`migrations/005_session_tombstones.sql`), so a book created by a typo sits in
the group create/edit picker forever, and the only recovery is a hand-written
`UPDATE` against Neon.

#24 forbids erasing things and #22 says nothing about the reverse of creation —
this is a gap, not a decision, exactly as issue 14's was.

It clears the bar because Jericho is one mistyped name away from permanently
cluttering the picker he uses on every group, with no self-service fix, and he
is the only user there is.

## Scope
- `retired_at timestamptz` on `books`, mirroring what `sessions` already has.
  New migration file — never edit one that has run.
- A control on `/books` (or a book's edit screen) that retires it, and a way
  back, since this issue exists precisely because one-way doors are the problem.
- Retired books disappear from the book picker on group create/edit and from
  `/books`' main list.
- ⛔ A book that a BGroup currently has as its `current_book_id` must **not**
  vanish out from under that group. Decide and state what happens: the honest
  options are refusing to retire it while a group holds it (and naming the
  group), or retiring it while leaving the holding group's book intact and
  still rendering its title everywhere it already appears. Do not silently
  NULL a group's current book.
- Nothing about history is rewritten (#24): sessions, completions and any
  meeting that named the book are untouched in either direction.

## Notes
- Seeded GLC books are **not** retirable — they have `owner_id IS NULL` and
  belong to no one (#32). Scope every write to `owner_id = $1`, as
  `src/lib/curriculum/custom.ts` already does.
- Follow `unarchiveGroup` / `archiveGroup` in `src/lib/roster/groups.ts` for the
  owner-scoped, guard-in-the-SQL idiom, and `restorePerson` for the way back.
- No artboard covers this surface. Follow the `/books` screens issue 13 built.
- Tests: server boundary, test Postgres, TDD red first. Cover: a retired book
  leaves `listOwnBooks` and the picker; a seeded book cannot be retired; the
  chosen behaviour for a book a group currently holds.
