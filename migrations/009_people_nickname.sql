-- bst-v1.1 issue 1 — the nickname a person is actually called by.
--
-- Optional and NULL by default. When it is set the app shows it everywhere a
-- person's name appears (roster, sheet, catch-up cards, guest labels, reports,
-- Home) and the person's own screen leads with it; the full name in
-- `people.name` stays the stored record. No uniqueness and no extra
-- constraint — the module holds it to the same two rules as `name`: trimmed,
-- and an empty one is the same as none at all.
--
-- Additive: `002` and `003` are not touched (see `src/lib/migrate.ts` for why
-- a correction is always a new file).

ALTER TABLE people ADD COLUMN IF NOT EXISTS nickname text;
