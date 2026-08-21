-- Meetings: a dated night a BGroup meets (#6/#7).
--
-- A meeting stores a LOCAL date and a LOCAL time, never a timestamp (#56) —
-- Vercel's functions run in UTC and a bare timestamp would move every meeting
-- if Jericho ever travelled. `Asia/Manila` is the wall clock these two columns
-- are read in, and the app converts nothing.
--
-- Time and duration are inherited from the group and may be overridden for one
-- night (#36), so they are written onto the row rather than joined from the
-- group: changing the group's regular hour must not rewrite the history of the
-- nights that already happened (#24).
--
-- Book and session are both optional (#26) — a fellowship night, a party or a
-- prayer meeting is a legal meeting and records no completions. There is no
-- location column, deliberately: the venue lives in `notes` (#54/#55).

CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Both always Jericho in v1 (#32). `led_by` is not a copy of `owner_id` by
  -- accident — v1.1's leader accounts push only the meetings a leader leads.
  owner_id text NOT NULL,
  led_by text NOT NULL,
  -- CASCADE is only ever exercised by a test teardown: a group is archived,
  -- never deleted (#27), and the app has no path that deletes one.
  group_id uuid NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  -- Optional together (#26). The book is stored beside the session because the
  -- group's current book moves on (#17) and a held night must still say which
  -- book it covered.
  book_id uuid REFERENCES books (id) ON DELETE SET NULL,
  session_id uuid REFERENCES sessions (id) ON DELETE SET NULL,
  -- Free text, and the only place a moved venue is recorded (#54/#55).
  notes text,
  -- #7/#26. Creating always yields 'proposed', whatever the date (#47); 'held'
  -- is a deliberate act taken on the attendance screen.
  status text NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'held', 'cancelled')),
  -- #73. 'generated' = the materialiser or a tapped ghost put it here;
  -- 'created' = Jericho typed it. It scopes the index below, and it also
  -- answers "did I schedule this or did the app?" for free.
  origin text NOT NULL CHECK (origin IN ('generated', 'created')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- #73's idempotency guard, and the reason `origin` exists. Every generation
-- path writes ON CONFLICT DO NOTHING against this, so a retry after Neon's
-- autosuspend `fetch failed` costs nothing. It is PARTIAL because a plain
-- unique index would also forbid a human-created make-up meeting on the same
-- day as the group's regular night — a ministry rule imposed by a sync fix.
CREATE UNIQUE INDEX IF NOT EXISTS meetings_generated_group_date_idx
  ON meetings (group_id, date) WHERE origin = 'generated';

-- The calendar's range read (issue 5) and the group history's, in that order.
CREATE INDEX IF NOT EXISTS meetings_owner_date_idx ON meetings (owner_id, date);
CREATE INDEX IF NOT EXISTS meetings_group_date_idx ON meetings (group_id, date);
