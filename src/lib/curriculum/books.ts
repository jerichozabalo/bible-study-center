/**
 * Reading the curriculum. Everything here is a read — the GLC rows arrive from
 * `seed.ts` and user-created books arrive in issue 13 (#22).
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

export async function listPrograms(): Promise<Program[]> {
  return query<Program>("SELECT id, name, position FROM programs ORDER BY position ASC");
}

export async function listBooks(): Promise<BookSummary[]> {
  const rows = await query<{
    id: string;
    number: number | null;
    title: string;
    program_name: string | null;
    session_count: number;
  }>(
    `SELECT b.id,
            b.number,
            b.title,
            p.name AS program_name,
            (SELECT count(*) FROM sessions s WHERE s.book_id = b.id)::int AS session_count
       FROM books b
       LEFT JOIN programs p ON p.id = b.program_id
      ORDER BY p.position ASC NULLS LAST, b.number ASC NULLS LAST, b.created_at ASC`,
  );

  return rows.map(toSummary);
}

export async function getBook(id: string): Promise<BookDetail | null> {
  const rows = await query<{
    id: string;
    number: number | null;
    title: string;
    program_name: string | null;
    session_count: number;
  }>(
    `SELECT b.id,
            b.number,
            b.title,
            p.name AS program_name,
            (SELECT count(*) FROM sessions s WHERE s.book_id = b.id)::int AS session_count
       FROM books b
       LEFT JOIN programs p ON p.id = b.program_id
      WHERE b.id = $1`,
    [id],
  );

  const book = rows[0];
  if (!book) return null;

  const sessions = await query<CurriculumSession>(
    "SELECT id, number, title FROM sessions WHERE book_id = $1 ORDER BY number ASC",
    [id],
  );

  return { ...toSummary(book), sessions };
}

function toSummary(row: {
  id: string;
  number: number | null;
  title: string;
  program_name: string | null;
  session_count: number;
}): BookSummary {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    programName: row.program_name,
    sessionCount: row.session_count,
  };
}
