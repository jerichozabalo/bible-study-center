-- The GLC 2025–26 editions (#77): retire the sessions the new printings
-- removed.
--
-- The seed (src/lib/curriculum/glc.ts) retitles the slots that survive — a
-- session number is an identity (issue 13), so Book 1's slot 5 becomes the new
-- edition's "One Pursuit — Living Victoriously in Christ" and every completion
-- on that row stays exactly where it is.
--
-- Removing a session is the one thing the seed cannot express: `seed.ts` only
-- inserts and updates, and `custom.ts`'s retire is owner-scoped so it can
-- never reach a seeded row. This file is that one-time edit.
--
-- Retirement is a tombstone, never a delete (#24): a completion or a meeting
-- that already points at one of these rows still resolves — the row simply
-- stops being part of its book. Nothing else is touched: no completion,
-- meeting, person or group.
--
-- The nine sessions the 2025–26 editions dropped, by book and session number:
--   Book 1: session 6        Book 2: session 6        Book 3: session 4
--   Book 4: sessions 3, 4    Book 5: session 4        Book 7: sessions 6, 7, 8
--
-- Idempotent on purpose — migrate.ts can genuinely run a file twice on one
-- pass — so every row is matched by natural key and guarded by
-- `retired_at IS NULL`. A brand-new database never has these rows at all: the
-- current seed inserts only the live 41.
UPDATE sessions s
   SET retired_at = now(), updated_at = now()
  FROM books b
 WHERE s.book_id = b.id
   AND b.owner_id IS NULL          -- seeded GLC rows only (#32)
   AND b.program_id IS NOT NULL
   AND s.retired_at IS NULL
   AND ((b.number = 1 AND s.number = 6)
     OR (b.number = 2 AND s.number = 6)
     OR (b.number = 3 AND s.number = 4)
     OR (b.number = 4 AND s.number IN (3, 4))
     OR (b.number = 5 AND s.number = 4)
     OR (b.number = 7 AND s.number IN (6, 7, 8)));
