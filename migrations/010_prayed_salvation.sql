-- bst-v1.1 issue 2 — the salvation prayer as its own milestone.
--
-- Mirrors `baptized` / `baptized_on` (003) exactly: the boolean alone answers
-- "yes, at some point", the date answers "when", and the module treats the date
-- as the stronger claim. Deliberately separate from the 4E ladder (#11) and
-- from baptism — this is where someone started, not a stage they have reached.
--
-- Additive: `002` and `003` are not touched (see `src/lib/migrate.ts` for why
-- a correction is always a new file).

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS prayed_salvation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prayed_salvation_on date;
