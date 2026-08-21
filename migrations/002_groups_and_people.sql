-- BGroups (#66's word — never DGroup), and the membership column they count.
--
-- A group carries the weekly schedule (#36: day + time + duration, one
-- recurrence per group per #48) and the current book (#17 — there is no
-- enrolment entity, #16). It is archived, never deleted (#27), which is why
-- `archived_at` is a timestamp rather than a boolean: the Groups screen prints
-- the date.
--
-- `people` is deliberately thin here. Issue 3 owns the roster and adds the
-- contact fields (#9/#9b), the 4E status (#11) and the joined-at markers (#28).
-- It exists in this migration because two things issue 2 must deliver point at
-- it: the member count on a group card, and #27's offer to move members
-- somewhere else when their group is archived.

CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Always Jericho in v1 (#32). Not a permission system — the point is that
  -- v1.1's leader accounts do not have to migrate live data.
  owner_id text NOT NULL,
  name text NOT NULL,
  -- 0 = Sunday, matching #46's Sunday-first calendar and JS's getDay().
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  -- Local wall-clock time, `Asia/Manila` semantics (#56) — never a timestamp,
  -- which would move the meeting if Jericho ever travelled.
  start_time time NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  current_book_id uuid REFERENCES books (id) ON DELETE SET NULL,
  -- NULL = active. Archived groups generate no ghosts and cannot be picked
  -- when creating a meeting (#60).
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS groups_active_idx ON groups (owner_id) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  name text NOT NULL,
  -- One home group per person (#15); attendance anywhere is still possible.
  -- ON DELETE SET NULL is a formality — #27 says a group is never deleted.
  home_group_id uuid REFERENCES groups (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS people_home_group_idx ON people (home_group_id);
