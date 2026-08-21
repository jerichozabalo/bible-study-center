-- Curriculum: Program -> Book -> Session.
--
-- #3 as amended by #33: the program (GLC 1 / GLC 2) is a real row from v1 with
-- a Book pointing at it, even though nothing in v1 can create one. Promoting a
-- free-text label to an entity later, across live data, is the migration this
-- avoids — and v1.1's certificates are issued per program.
--
-- The seed itself is not here. It lives in `src/lib/curriculum/glc.ts` and is
-- applied by `seedCurriculum()`, so the 50 published titles sit in one
-- greppable place that the tests can compare the database against, rather than
-- in a SQL file no test can read.

CREATE TABLE IF NOT EXISTS programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  -- #33's "order". `order` is reserved and `position` is what the rest of this
  -- schema will call the same idea.
  position integer NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL = a book Jericho wrote himself (#22, issue 13). Programs stay
  -- seeded-only in v1 (#33), so a custom book belongs to no program.
  program_id uuid REFERENCES programs (id) ON DELETE RESTRICT,
  -- The published book number ("Book 5: DGroup 101"). NULL for custom books,
  -- which have no number in anyone's printed material.
  number integer,
  -- The published title WITHOUT its "Book n:" prefix — the number above is
  -- data, not prose, and every screen renders the two together.
  title text NOT NULL,
  -- Stamped for user-created books only; seeded rows belong to no one (#32).
  owner_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The seed's natural key: re-seeding finds Book 3 of GLC 1 rather than adding a
-- second one. Custom books have a NULL program_id, and Postgres treats NULLs as
-- distinct, so this never constrains them.
CREATE UNIQUE INDEX IF NOT EXISTS books_program_number_idx ON books (program_id, number);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books (id) ON DELETE CASCADE,
  number integer NOT NULL,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (book_id, number)
);
