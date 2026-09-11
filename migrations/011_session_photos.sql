-- bst-v1.1 issue 4 — session photos: the archive that builds itself.
--
-- One row per photo on a meeting record. `r2_key` is the archive copy (what
-- the leader keeps), `r2_thumb_key` the small variant the public site will
-- request (ministry-support-site issue 11); both live in the same bucket under
-- `sessions/<group>/<date>/<uuid>.jpg`.
--
-- `consent_confirmed_at` is the whole point of this table's shape: consent is a
-- recorded MOMENT — the leader ticked one box per upload batch saying everyone
-- in these photos was asked when the photo was taken — not an assumption
-- attached to each file. There is deliberately NO per-photo public/private
-- toggle (decided against in the grilling; do not reintroduce it).
--
-- Delete really deletes (row and objects): the grilled spec chose removal so a
-- withdrawn consent takes the photo off the public site on its next revalidate.
-- #24's tombstone doctrine is about records of attendance; this is an image the
-- ministry has been asked to stop showing.

CREATE TABLE IF NOT EXISTS session_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  -- ON DELETE CASCADE is not a licence to delete a meeting (#24); it is here so
  -- the test fixtures can empty their rows between cases.
  meeting_id uuid NOT NULL REFERENCES meetings (id) ON DELETE CASCADE,
  -- Free text, optional. The date is the day the photo was taken (#56): a
  -- calendar day, `YYYY-MM-DD`, never an instant.
  caption text,
  taken_on date NOT NULL,
  consent_confirmed_at timestamptz NOT NULL,
  r2_key text NOT NULL,
  r2_thumb_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS session_photos_meeting_idx
  ON session_photos (meeting_id, taken_on DESC, created_at DESC);
