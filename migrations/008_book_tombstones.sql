-- Retired custom books (#24 — nothing is truly erased; #22 — the books Jericho
-- wrote himself).
--
-- Creating a custom book (issue 13) was a one-way door: a book named by a typo
-- sat in the group create/edit picker and on `/books` forever, and the only
-- recovery was a hand-written UPDATE against Neon. This is the same shape of
-- trap `sessions.retired_at` (005) and a BGroup's `archived_at` already fixed —
-- issue 16 gives books the same flag and a way back.
--
-- Reads in `src/lib/curriculum/books.ts` skip retired books from the two lists
-- that *offer* a book — `listOwnBooks` (the main /books list) and `listBooks`
-- (the picker) — but `getBook`, which looks a book up by id, still returns it:
-- a BGroup that already adopted the book still has to draw its title and its
-- sessions everywhere it already appears.
--
-- Seeded GLC rows are never retired: they have `owner_id IS NULL` (#32) and
-- every write in `custom.ts` is scoped to `owner_id = $1`, so a retire
-- statement simply cannot match one. `seed.ts` only ever inserts and updates.

ALTER TABLE books ADD COLUMN IF NOT EXISTS retired_at timestamptz;
