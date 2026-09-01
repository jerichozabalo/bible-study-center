/**
 * Reading the curriculum. Everything here is a read — the GLC rows arrive from
 * `seed.ts` and user-created books from `custom.ts` (#22).
 *
 * Books are ordered the way CCF numbers them (GLC 1's four, then GLC 2's four),
 * with any custom book after them: a picker that puts "Book 1 — One By One"
 * first is a picker Jericho can use without reading it.
 */
import { query } from "../db";

export type BookSummary = {
  id: string;
  /** NULL for a book Jericho wrote himself — it has no published number. */
  number: number | null;
  title: string;
  /** NULL for a custom book; programs are seeded-only in v1 (#33). */
  programName: string | null;
  sessionCount: number;
};

export type CurriculumSession = {
  id: string;
  number: number;
  title: string;
};

export type BookDetail = BookSummary & { sessions: CurriculumSession[] };

export type Program = {
  id: string;
  name: string;
  position: number;
};

/**
 * How a book is named anywhere it appears: "Book 1 — One By One". A custom book
 * (#22) has no number and is simply its own title.
 */
export function bookLabel(book: { number: number | null; title: string }): string {
  return book.number === null ? book.title : `Book ${book.number} — ${book.title}`;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SELECT_BOOK = `
  SELECT b.id,
         b.number,
         b.title,
         p.name AS program_name,
         (SELECT count(*) FROM sessions s WHERE s.book_id = b.id AND s.retired_at IS NULL)::int
           AS session_count
    FROM books b
    LEFT JOIN programs p ON p.id = b.program_id
`;

export async function listPrograms(): Promise<Program[]> {
  return query<Program>("SELECT id, name, position FROM programs ORDER BY position ASC");
}

export async function listBooks(): Promise<BookSummary[]> {
  const rows = await query<BookRow>(
    `${SELECT_BOOK} ORDER BY p.position ASC NULLS LAST, b.number ASC NULLS LAST, b.created_at ASC`,
  );

  return rows.map(toSummary);
}

/**
 * The books Jericho wrote himself (#22), oldest first — the same order the
 * picker puts them in, so the two screens do not disagree about which book is
 * which. Seeded rows belong to no one (#32), so they can never appear here.
 */
export async function listOwnBooks(ownerId: string): Promise<BookSummary[]> {
  const rows = await query<BookRow>(
    `${SELECT_BOOK} WHERE b.owner_id = $1 ORDER BY b.created_at ASC`,
    [ownerId],
  );

  return rows.map(toSummary);
}

/**
 * The book after this one in the published order — everything "advance" (#4)
 * has to know, and the only place that order is written down.
 *
 * Books are ordered by program then number (#33), so the book after Book 4 is
 * Book 5: finishing GLC 1 is a certificate boundary in v1.1, not a dead end the
 * leader has to step around by hand today.
 *
 * NULL for the last book, and NULL for a book Jericho wrote himself (#22) —
 * a custom book has no number and no program, so nothing can follow it. Custom
 * books are never offered as what comes next either: they are not part of
 * anyone's printed curriculum, and the group's "Change book" is how one gets
 * chosen.
 */
export async function getNextBook(id: string): Promise<BookSummary | null> {
  if (!UUID_PATTERN.test(id)) return null;

  const rows = await query<BookRow>(
    `${SELECT_BOOK}
      WHERE b.program_id IS NOT NULL
        AND (p.position, b.number) > (
              SELECT here_program.position, here.number
                FROM books here
                JOIN programs here_program ON here_program.id = here.program_id
               WHERE here.id = $1
            )
      ORDER BY p.position ASC, b.number ASC
      LIMIT 1`,
    [id],
  );

  return rows[0] ? toSummary(rows[0]) : null;
}

export async function getBook(id: string): Promise<BookDetail | null> {
  if (!UUID_PATTERN.test(id)) return null;

  const rows = await query<BookRow>(`${SELECT_BOOK} WHERE b.id = $1`, [id]);
  return rows[0] ? withSessions(rows[0]) : null;
}

/**
 * One of the leader's own books, for the screen that edits it.
 *
 * Scoped rather than filtered afterwards, because the answer for a seeded book
 * is the same as for a book that does not exist: CCF's published material is
 * not Jericho's to rewrite, and the edit screen must not open on it.
 */
export async function getOwnBook(ownerId: string, id: string): Promise<BookDetail | null> {
  if (!UUID_PATTERN.test(id)) return null;

  const rows = await query<BookRow>(`${SELECT_BOOK} WHERE b.id = $1 AND b.owner_id = $2`, [
    id,
    ownerId,
  ]);
  return rows[0] ? withSessions(rows[0]) : null;
}

async function withSessions(row: BookRow): Promise<BookDetail> {
  // Retired sessions are excluded everywhere the curriculum is read (#24): the
  // tombstone exists so a completion that already points at one still resolves,
  // not so the session stays part of the book.
  const sessions = await query<CurriculumSession>(
    `SELECT id, number, title FROM sessions
      WHERE book_id = $1 AND retired_at IS NULL
      ORDER BY number ASC`,
    [row.id],
  );

  return { ...toSummary(row), sessions };
}

type BookRow = {
  id: string;
  number: number | null;
  title: string;
  program_name: string | null;
  session_count: number;
};

function toSummary(row: BookRow): BookSummary {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    programName: row.program_name,
    sessionCount: row.session_count,
  };
}
