/**
 * Writing the curriculum: the books Jericho wrote himself (#22), so the app
 * outlives the GLC material.
 *
 * A custom book belongs to **no program** in v1 (#33) and carries no published
 * number — nothing in v1 can create a program, and a book of his own has no
 * "Book n" in anyone's printed material. It is stamped with `owner_id`, which
 * seeded rows never carry (#32); that stamp is what tells the two apart
 * everywhere, and it is why nothing here can reach a GLC row.
 *
 * Reads live next door in `books.ts` — a custom book is read by exactly the
 * same functions as a seeded one, which is the whole point of the issue.
 *
 * Validation throws `CurriculumValidationError` and the server actions above
 * turn that into a sentence on the form; anything else — a dropped connection,
 * a constraint nobody expected — surfaces as the error it is. The same shape as
 * `roster/groups.ts`.
 */
import { type TransactionClient, query, transaction } from "../db";

/** Something the leader typed cannot be saved, and the message says why. */
export class CurriculumValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CurriculumValidationError";
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One sentence for "not yours" and for "not there". Which one it is, is not
 * information the leader needs and not information the app should hand out.
 */
const NOT_YOURS = "That book is not one of yours to edit.";

/** A session as the editor posts it: an existing row, or one being added. */
export type CustomSessionInput = {
  /** NULL for a session that does not exist yet. */
  id: string | null;
  title: string;
};

export type CustomBookInput = {
  title: string;
  sessions: CustomSessionInput[];
};

export async function createBook(ownerId: string, input: CustomBookInput): Promise<string> {
  const clean = validate(input);

  return transaction(async (tx) => {
    const [{ id }] = await tx.query<{ id: string }>(
      // `program_id` and `number` are left NULL deliberately (#33) — the
      // seed's unique index on (program_id, number) treats NULLs as distinct,
      // so custom books never collide with each other or with GLC.
      "INSERT INTO books (owner_id, title) VALUES ($1, $2) RETURNING id",
      [ownerId, clean.title],
    );

    await insertSessions(
      tx,
      id,
      1,
      clean.sessions.map((session) => session.title),
    );

    return id;
  });
}

/**
 * Save an edited book: the title, the sessions kept (renamed in place), the
 * sessions added, and the sessions dropped.
 *
 * Dropping tombstones rather than deletes (#24). The issue's rule is "editable
 * freely until a group has held meetings against it, tombstoned corrections
 * after" — there are no meetings yet (issue 4) and no completions (issue 9), so
 * there is nothing to ask. Tombstoning always is the answer that is right
 * whichever of those two worlds this runs in: a session that nothing points at
 * loses nothing by surviving as a retired row, and a session that something
 * points at would lose everything by being deleted.
 *
 * Kept sessions keep their ids, so a rename is a correction to the wording
 * rather than a new session nobody has attended.
 */
export async function updateBook(
  ownerId: string,
  id: string,
  input: CustomBookInput,
): Promise<void> {
  const clean = validate(input);

  if (!UUID_PATTERN.test(id)) throw new CurriculumValidationError(NOT_YOURS);

  await transaction(async (tx) => {
    // Seeded books have a NULL `owner_id` (#32), so this same clause is what
    // stops CCF's published material being rewritten.
    const book = await tx.query<{ id: string }>(
      "SELECT id FROM books WHERE id = $1 AND owner_id = $2 FOR UPDATE",
      [id, ownerId],
    );
    if (book.length === 0) throw new CurriculumValidationError(NOT_YOURS);

    const existing = await tx.query<{ id: string; number: number; retired_at: Date | null }>(
      "SELECT id, number, retired_at FROM sessions WHERE book_id = $1",
      [id],
    );
    const live = new Set(
      existing.filter((session) => session.retired_at === null).map((session) => session.id),
    );

    const kept = clean.sessions.filter((session) => session.id !== null);
    for (const session of kept) {
      // A posted id that is not a live session of this book means a stale or a
      // tampered form. Either way it is not an edit this book can make.
      if (!live.has(session.id!)) {
        throw new CurriculumValidationError("That session is not part of this book.");
      }
    }
    if (new Set(kept.map((session) => session.id)).size !== kept.length) {
      throw new CurriculumValidationError("That session is not part of this book.");
    }

    await tx.query("UPDATE books SET title = $2, updated_at = now() WHERE id = $1", [
      id,
      clean.title,
    ]);

    if (kept.length > 0) {
      await tx.query(
        `UPDATE sessions s
            SET title = t.title, updated_at = now()
           FROM unnest($2::uuid[], $3::text[]) AS t(id, title)
          WHERE s.id = t.id AND s.book_id = $1`,
        [id, kept.map((session) => session.id), kept.map((session) => session.title)],
      );
    }

    await tx.query(
      `UPDATE sessions
          SET retired_at = now(), updated_at = now()
        WHERE book_id = $1 AND retired_at IS NULL AND NOT (id = ANY($2::uuid[]))`,
      [id, kept.map((session) => session.id)],
    );

    // Numbers are identities, not positions: the next one is after every number
    // this book has ever used, retired ones included (see migration 005).
    const nextNumber =
      existing.reduce((highest, session) => Math.max(highest, session.number), 0) + 1;
    await insertSessions(
      tx,
      id,
      nextNumber,
      clean.sessions.filter((session) => session.id === null).map((session) => session.title),
    );
  });
}

/**
 * Retire a custom book (issue 16) — take it out of the picker and the `/books`
 * list without touching a BGroup that adopted it or any progress recorded
 * against it (#24). The mirror of `archiveGroup` in `roster/groups.ts`.
 *
 * `owner_id = $2` is the whole safety rule, the same clause `updateBook` leans
 * on: a seeded GLC book has a NULL `owner_id` (#32) and belongs to no one, so
 * this statement can never match one — a seeded book is simply not retirable.
 *
 * A book a BGroup currently holds as its `current_book_id` is refused, and the
 * group(s) are named. The app never silently NULLs a group's book (#17), and
 * the honest fix is to change that group's book first. `getBook` still returns
 * a retired book by id, so wherever a holding group already draws its title and
 * sessions, it keeps drawing them.
 */
export async function retireBook(ownerId: string, id: string): Promise<void> {
  if (!UUID_PATTERN.test(id)) throw new CurriculumValidationError(NOT_YOURS);

  await transaction(async (tx) => {
    const book = await tx.query<{ id: string; title: string }>(
      "SELECT id, title FROM books WHERE id = $1 AND owner_id = $2 AND retired_at IS NULL FOR UPDATE",
      [id, ownerId],
    );
    if (book.length === 0) throw new CurriculumValidationError(NOT_YOURS);

    const holding = await tx.query<{ name: string }>(
      `SELECT name FROM groups
        WHERE owner_id = $2 AND current_book_id = $1 AND archived_at IS NULL
        ORDER BY lower(name) ASC`,
      [id, ownerId],
    );
    if (holding.length > 0) {
      const names = nameList(holding.map((group) => group.name));
      const whose = holding.length === 1 ? "that group's" : "those groups'";
      throw new CurriculumValidationError(
        `${book[0].title} is still the current book for ${names}. Change ${whose} book first.`,
      );
    }

    await tx.query(
      `UPDATE books SET retired_at = now(), updated_at = now()
        WHERE id = $1 AND owner_id = $2 AND retired_at IS NULL`,
      [id, ownerId],
    );
  });
}

/**
 * Bring a retired custom book back (issue 16 — creation was a one-way door).
 *
 * The mirror of `retireBook`, and deliberately smaller: retiring can be refused
 * because a BGroup might hold the book, un-retiring undoes a mis-tap and asks
 * nothing. `retired_at IS NOT NULL` matches the guard on the way in, so a live
 * book is a no-op rather than a fresh `updated_at`. Nothing about history
 * changes in either direction (#24).
 */
export async function unretireBook(ownerId: string, id: string): Promise<void> {
  if (!UUID_PATTERN.test(id)) throw new CurriculumValidationError(NOT_YOURS);

  await query(
    `UPDATE books SET retired_at = NULL, updated_at = now()
      WHERE id = $1 AND owner_id = $2 AND retired_at IS NOT NULL`,
    [id, ownerId],
  );
}

/** "a", "a and b", "a, b and c" — for naming the BGroups that still hold a book. */
function nameList(names: string[]): string {
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

async function insertSessions(
  tx: TransactionClient,
  bookId: string,
  firstNumber: number,
  titles: string[],
): Promise<void> {
  if (titles.length === 0) return;

  // One statement rather than one per session: this runs from a home line in
  // Bulacan to Singapore, the same reason `seed.ts` gives.
  await tx.query(
    `INSERT INTO sessions (book_id, number, title)
     SELECT $1, $2::int + ordinality::int - 1, title
     FROM unnest($3::text[]) WITH ORDINALITY AS t(title, ordinality)`,
    [bookId, firstNumber, titles],
  );
}

function validate(input: CustomBookInput): CustomBookInput {
  const title = input.title.trim();
  if (title.length === 0) throw new CurriculumValidationError("A book needs a name.");

  const sessions = input.sessions.map((session) => ({
    id: session.id,
    title: session.title.trim(),
  }));

  if (sessions.some((session) => session.title.length === 0)) {
    throw new CurriculumValidationError("Every session needs a title.");
  }

  // #5 is strict: a book is complete when ALL its sessions are done. A book
  // with none would be complete the moment a group adopted it.
  if (sessions.length === 0) {
    throw new CurriculumValidationError("A book needs at least one session.");
  }

  return { title, sessions };
}
