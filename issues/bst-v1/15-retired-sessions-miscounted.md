---
issue: 15
title: A group's session count includes retired sessions
status: open
blocked-by: [13]
type: afk
---

# A group's session count includes retired sessions

## Goal
Every screen that counts a book's sessions counts the same sessions. Removing a
session from a custom book makes the Groups card and GroupDetail agree with the
book itself.

## Why this exists
Discovered while supervising issue 13 (2026-08-21), not planned. Verified in the
code, not taken on report.

Issue 13 gave `sessions` a `retired_at` column (`migrations/005_session_tombstones.sql`)
because removing a session from a custom book must tombstone rather than delete
(#24) — a completed "session 2" must never silently re-point at different
material. `src/lib/curriculum/books.ts` filters correctly in both places it
counts (`… WHERE s.book_id = b.id AND s.retired_at IS NULL`, and again when
listing a book's sessions).

`src/lib/roster/groups.ts` does not. Its `SELECT_GROUP` builds
`current_book_session_count` as
`COALESCE((SELECT count(*) FROM sessions s WHERE s.book_id = b.id), 0)::int`
with no `retired_at` clause.

Symptom: Jericho creates a custom book with 4 sessions, a BGroup adopts it, he
removes one session. `/books` says 3 sessions; the Groups card and GroupDetail
say 4. Two screens in the same app disagree about the same book, and the wrong
one is the screen he looks at most.

It clears the bar because it is a visible falsehood about his own data with no
workaround, and he is the only user there is.

## Scope
- Add `AND s.retired_at IS NULL` to the session count in `groups.ts`'s
  `SELECT_GROUP`.
- Sweep for any other place that counts or lists sessions without the clause —
  this is a two-file inconsistency today and the point of the issue is that it
  stays a one-file rule afterwards.

## Notes
- Seeded GLC books have no retired sessions, so nothing about the eight
  published books changes. This is only reachable through a custom book (#22).
- ⚠️ Session numbers are identities, not positions (issue 13's deliberate
  call): `UNIQUE (book_id, number)` stands, a retired number is never re-used,
  and a book that lost its second session reads 1, 3, 4. Do **not** "fix" that
  here by renumbering — it would re-point completions at different material.
  Only the *count* is wrong.
- Tests: server boundary, test Postgres, TDD red first. Cover a group whose
  current book has a retired session — the count must match `getBook`'s.
