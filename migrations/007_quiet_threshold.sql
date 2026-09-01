-- The per-group quiet threshold (#10/#64 — "a BGroup can set its own").
--
-- The quiet list (issue 8) flags a member who has missed this many of their
-- home group's most recent HELD meetings in a row (#64 — the unit is held
-- meetings, never weeks; cancelled and never-scheduled nights never count).
--
-- It lives on `groups` rather than in an account-wide setting because the
-- decision log says the threshold is per-group: a fortnightly group and a
-- weekly one do not go quiet at the same pace. Default 3, and the only values
-- the Settings picker offers are 2 / 3 / 4 — the same shape as `weekday`'s
-- range check, so a stale form gets a constraint rather than a silent 7.
--
-- Additive per the runner's rules: a column with a default, never a rewrite.

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS quiet_threshold smallint NOT NULL DEFAULT 3
    CHECK (quiet_threshold BETWEEN 2 AND 4);
