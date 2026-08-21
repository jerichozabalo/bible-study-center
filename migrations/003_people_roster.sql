-- The roster: the rest of a Person, the joined-at markers (#28), and the
-- tombstones every correction leaves behind (#24).
--
-- `002` created `people` deliberately thin — a name and a home group, which was
-- all issue 2 needed to count members and offer #27's bulk move. This file is
-- the rest of #9/#9b, and it is additive: 002 is not touched (see
-- `src/lib/migrate.ts` for why a correction is always a new file).
--
-- Two things are NOT columns here, on purpose:
--
--   * **Age** is derived from the birthday (#9b), never stored — a stored age
--     is wrong within a year of being written.
--   * **"Contact incomplete"** (#9/#67) is derived from phone and email being
--     both NULL. A stored flag would have to be cleared by whoever finally
--     types the number, and the walk-in path (issue 6) is exactly where nobody
--     will remember to.
--
-- No photo column: photos are v1.1 (#9b).

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  -- The day this person joined the ministry (#9b). NOT NULL with a default so
  -- the thin rows 002 allowed still answer the question; every row the roster
  -- module writes carries an explicit value, read in Manila (#56) rather than
  -- from the server's own clock.
  ADD COLUMN IF NOT EXISTS joined_on date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS birthday date,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS civil_status text
    CHECK (civil_status IN ('Single', 'Married', 'Widowed', 'Separated')),
  -- CCF's 4E ladder (#11). Baptism is tracked separately, below, because it is
  -- an event and not a stage.
  ADD COLUMN IF NOT EXISTS spiritual_status text
    CHECK (spiritual_status IN ('Engage', 'Edify', 'Equip', 'Empower')),
  -- "baptized", that spelling, everywhere (#66).
  ADD COLUMN IF NOT EXISTS baptized boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS baptized_on date,
  -- Free text, not a person reference: the one who invited someone is very
  -- often not on the roster themselves.
  ADD COLUMN IF NOT EXISTS invited_by text,
  ADD COLUMN IF NOT EXISTS notes text,
  -- #10's manual override, in #66's words: "Stepped away", never "Closed".
  -- A date rather than a boolean, because the quiet list will want to know
  -- since when.
  ADD COLUMN IF NOT EXISTS stepped_away_on date,
  -- #24: removal is a date and a way back, never a DELETE.
  ADD COLUMN IF NOT EXISTS removed_at timestamptz;

CREATE INDEX IF NOT EXISTS people_roster_idx ON people (owner_id) WHERE removed_at IS NULL;

-- #28 — the joined-at marker, one row per stretch of membership.
--
-- One home group at a time (#15), enforced below by a partial unique index on
-- the open row. A transfer (#27) closes the current row and opens another, so
-- "when did she join THIS group, and what book were they on" survives the move
-- — which is what makes a mid-book joiner readable rather than merely behind.
CREATE TABLE IF NOT EXISTS group_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  -- CASCADE is not a licence to delete a person (#24 forbids it); it is here so
  -- the test fixtures can empty the roster between cases.
  person_id uuid NOT NULL REFERENCES people (id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  joined_on date NOT NULL,
  -- The book the group was on that day. The session they joined at is NOT
  -- stored: it is derivable from the meetings held before this date once
  -- issue 4 exists, and a stored copy would be a second answer that can drift.
  joined_at_book_id uuid REFERENCES books (id) ON DELETE SET NULL,
  -- NULL = this is where they are now.
  ended_on date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS group_memberships_person_idx ON group_memberships (person_id);
CREATE INDEX IF NOT EXISTS group_memberships_group_idx ON group_memberships (group_id);
CREATE UNIQUE INDEX IF NOT EXISTS group_memberships_open_idx
  ON group_memberships (person_id) WHERE ended_on IS NULL;

-- #24 — free editing and backdating, but a correction keeps what it replaced.
--
-- The whole previous row as jsonb rather than a column per field: the record
-- being kept is "what it said before", and a schema that has to be extended
-- every time Person gains a field is a schema that will silently stop keeping
-- part of it.
CREATE TABLE IF NOT EXISTS person_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  person_id uuid NOT NULL REFERENCES people (id) ON DELETE CASCADE,
  -- 'edit' | 'stepped-away' | 'removed' | 'restored'
  reason text NOT NULL,
  previous jsonb NOT NULL,
  corrected_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS person_corrections_person_idx
  ON person_corrections (person_id, corrected_at);
