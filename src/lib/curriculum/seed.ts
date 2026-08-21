/**
 * Put the GLC curriculum in the database, and put it there the same way every
 * time. `npm run db:migrate` runs this after the schema migrations.
 *
 * Upsert rather than insert, on the natural keys (program name; program +
 * book number; book + session number), for two reasons. A group's
 * `current_book_id` points at a row (#17), so re-seeding must find Book 1 again
 * rather than mint a second one — and a corrected title should reach a database
 * that already has the old one, which `DO NOTHING` would not do.
 *
 * User-created books (#22, issue 13) have a NULL `program_id` and are never
 * touched here.
 */
import { transaction } from "../db";
import { GLC_PROGRAMS } from "./glc";

export async function seedCurriculum(): Promise<void> {
  await transaction(async (tx) => {
    for (const program of GLC_PROGRAMS) {
      const [{ id: programId }] = await tx.query<{ id: string }>(
        `INSERT INTO programs (name, position)
         VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET position = EXCLUDED.position
         RETURNING id`,
        [program.name, program.position],
      );

      for (const book of program.books) {
        const [{ id: bookId }] = await tx.query<{ id: string }>(
          `INSERT INTO books (program_id, number, title)
           VALUES ($1, $2, $3)
           ON CONFLICT (program_id, number)
             DO UPDATE SET title = EXCLUDED.title, updated_at = now()
           RETURNING id`,
          [programId, book.number, book.title],
        );

        // One statement per book rather than one per session: this runs on a
        // connection to Singapore from a home line in Bulacan, and 50 round
        // trips inside a transaction is a slow deploy step for no gain.
        await tx.query(
          `INSERT INTO sessions (book_id, number, title)
           SELECT $1, ordinality::int, title
           FROM unnest($2::text[]) WITH ORDINALITY AS t(title, ordinality)
           ON CONFLICT (book_id, number)
             DO UPDATE SET title = EXCLUDED.title, updated_at = now()`,
          [bookId, book.sessions],
        );
      }
    }
  });
}
