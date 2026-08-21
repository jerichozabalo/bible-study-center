-- Tombstoned session corrections (#24 — nothing is truly erased).
--
-- Removing a session from a book Jericho wrote himself (#22, issue 13) sets
-- this instead of deleting the row, so whatever already pointed at that session
-- — a completion (#65), a meeting's agenda (#53) — still resolves. Reads in
-- `src/lib/curriculum/books.ts` skip retired rows, so a retired session is gone
-- from the book without being gone from the database.
--
-- Session numbers stay identities rather than positions: 001's
-- UNIQUE (book_id, number) is left exactly as it is, and a retired session
-- keeps its number forever, so the next session added takes the next unused
-- one. A book that had its second session removed reads 1, 3, 4 — the gap is
-- the honest record of what happened, and re-using number 2 would silently
-- re-point anyone's completed session 2 at different material.
--
-- Seeded rows are never retired; `seed.ts` only ever inserts and updates.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS retired_at timestamptz;
