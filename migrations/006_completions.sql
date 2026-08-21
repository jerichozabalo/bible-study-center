-- Completions: what an attendance sheet leaves behind (#25/#65).
--
-- One row per (person, meeting), enforced below, and that uniqueness is the
-- whole model: the quiet list (#64) reads *attendance* from this table and the
-- certificate reads *sessions* from the same rows, so a second table for "was
-- present" would be two answers to one question.
--
-- `session_id` is NULLABLE, and the NULL carries meaning (#65):
--
--   * a row WITH a session = that person covered it, and it counts toward the
--     book (#5's strict completion reads these);
--   * a row with NULL = they were in the room and covered nothing. Two ways to
--     get there and both are legal — a fellowship night, a party or a prayer
--     meeting covers no session at all (#26), and "present only" (#25) records
--     someone who came but did not do the lesson.
--
-- `mark` is what separates those two NULLs. It is not a second copy of the
-- session: 'attended' means the tick, and the session written beside it is
-- whatever the meeting itself covered — which is NULL on a fellowship night.
-- 'present-only' always writes NULL, so nothing that counts book progress ever
-- has to know about marks.
--
-- There is no 'absent' mark. A person with no row simply has no record of that
-- night, which is what "missed it" means to #64's counter.

CREATE TABLE IF NOT EXISTS completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Always Jericho in v1 (#32), stamped so v1.1's leader accounts inherit a
  -- scoped table rather than a migration.
  owner_id text NOT NULL,
  -- CASCADE is a test-teardown affordance, not a delete path: people are
  -- removed with a date (#24) and meetings are cancelled, never deleted.
  person_id uuid NOT NULL REFERENCES people (id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES meetings (id) ON DELETE CASCADE,
  -- SET NULL rather than CASCADE: a session is retired, not deleted (005), so
  -- this only fires if a book is deleted outright — and losing the credit is
  -- better than losing the record that they were there.
  session_id uuid REFERENCES sessions (id) ON DELETE SET NULL,
  mark text NOT NULL CHECK (mark IN ('attended', 'present-only')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- #65, said in the schema: one row per (person, meeting), whatever the mark.
CREATE UNIQUE INDEX IF NOT EXISTS completions_person_meeting_idx
  ON completions (person_id, meeting_id);

-- The sheet's read (every row of one meeting) and the person's (everything one
-- person has covered), in that order.
CREATE INDEX IF NOT EXISTS completions_meeting_idx ON completions (meeting_id);
CREATE INDEX IF NOT EXISTS completions_person_idx ON completions (person_id);

-- #24 — a tick that is changed or taken back keeps what it replaced.
--
-- Same shape as `person_corrections` (003), and for the same reason: the whole
-- previous row as jsonb, so a schema change here cannot silently stop keeping
-- part of it. Unticking DELETEs the completion, which is why this table exists:
-- the row it removed is preserved here in full, so nothing is truly erased even
-- though nothing is left behind on the sheet.
CREATE TABLE IF NOT EXISTS completion_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  person_id uuid NOT NULL REFERENCES people (id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES meetings (id) ON DELETE CASCADE,
  -- 'edit' | 'cleared'
  reason text NOT NULL,
  previous jsonb NOT NULL,
  corrected_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS completion_corrections_meeting_idx
  ON completion_corrections (meeting_id, corrected_at);
