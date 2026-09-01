/**
 * Strict book completion (#5) and the progress the screens draw from it.
 *
 * This is the read-only half of the app (PRD module 6): nothing here writes,
 * and nothing here is stored. Progress is not a record — it is what a set of
 * completions means against a book's sessions, recomputed every time it is
 * asked for. Four rules do all the work:
 *
 * 1. **Strict (#5).** A book is complete for a person when EVERY one of its
 *    live sessions has a crediting completion of theirs. There is no partial
 *    credit and no override: eleven of Book 8's twelve is eleven of twelve.
 * 2. **Crediting means the same thing it means in `listCoveredSessions`.** A
 *    row with a session, on a night that was not cancelled (#50), against a
 *    session that has not been retired (005). A NULL-session row credits
 *    nothing (#65) — present at a fellowship night, or 'present only'.
 * 3. **Order is not enforced.** Progress is a *set*: a session covered as a
 *    ride-along at another BGroup (#31) counts exactly as much as the one
 *    covered at home, and covering session 5 before session 3 is not a defect.
 * 4. **Per person, never per group (#2).** `getGroupBookProgress` looks like a
 *    group record and is not one — it is a roll-up of its members' own facts,
 *    computed on read, which is why a member who transfers takes their progress
 *    with them and no count has to be repaired.
 *
 * #28's joined-at marker is derived here too, because it is the difference
 * between "behind" and "arrived late": a session their own BGroup held before
 * they joined it is one they were never in the room for.
 */
import { query } from "../db";

/** One session of a book, as one dot (#68). */
export type SessionProgress = {
  sessionId: string;
  number: number;
  title: string;
  /** #5 — a crediting completion exists. The only thing that fills a dot. */
  covered: boolean;
  /** `YYYY-MM-DD` of the night they covered it; NULL if they have not. */
  date: string | null;
  /** #28 — their own BGroup held it before they joined. */
  beforeJoining: boolean;
};

/** One book's dot row on the Person screen. */
export type BookProgress = {
  bookId: string;
  /** NULL for a book Jericho wrote himself (#22). */
  bookNumber: number | null;
  bookTitle: string;
  sessions: SessionProgress[];
  coveredCount: number;
  sessionCount: number;
  /** #5 — every session, or it is not complete. */
  complete: boolean;
  /** #28 — the first session they could have been at; NULL if they saw it all. */
  joinedAtSessionNumber: number | null;
};

/** One member of a BGroup, against the book the group is on (#17). */
export type MemberProgress = {
  personId: string;
  name: string;
  coveredCount: number;
  sessionCount: number;
  /** #5, for this member, of this book. */
  complete: boolean;
  /** The group has covered something they have not — what CATCH-UP names (#66). */
  behind: boolean;
  missingSessionNumbers: number[];
  /** #28 — the marker that keeps the left-behind list readable. */
  joinedAtSessionNumber: number | null;
};

/** The BGroup's current book, and how its members stand against it. */
export type GroupBookProgress = {
  bookId: string;
  bookNumber: number | null;
  bookTitle: string;
  sessions: { sessionId: string; number: number; title: string; coveredByGroup: boolean }[];
  sessionCount: number;
  coveredByGroupCount: number;
  /** The group has held a night on every session of the book. */
  groupComplete: boolean;
  /** Alphabetical, like every other list of people. */
  members: MemberProgress[];
  completeMemberCount: number;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Every book, with this person's dots on it — the Person screen's Progress
 * section, in the curriculum's own order.
 *
 * The published curriculum is always listed, started or not: "Not started" is
 * an answer, and a screen that only showed books someone had touched would hide
 * the ladder they are climbing. A custom book (#22) appears once it is relevant
 * — they have covered something in it, or their BGroup is on it.
 */
export async function getPersonProgress(
  ownerId: string,
  personId: string,
): Promise<BookProgress[]> {
  if (!UUID_PATTERN.test(personId)) return [];

  const rows = await query<{
    book_id: string;
    book_number: number | null;
    book_title: string;
    session_id: string;
    session_number: number;
    session_title: string;
    covered_date: string | null;
    before_joining: boolean;
  }>(
    `WITH home AS (
       SELECT p.id AS person_id,
              p.home_group_id AS group_id,
              gm.joined_on
         FROM people p
         LEFT JOIN group_memberships gm
           ON gm.person_id = p.id AND gm.group_id = p.home_group_id AND gm.ended_on IS NULL
        WHERE p.owner_id = $1 AND p.id = $2
     )
     SELECT b.id AS book_id,
            b.number AS book_number,
            b.title AS book_title,
            s.id AS session_id,
            s.number AS session_number,
            s.title AS session_title,
            covered.date AS covered_date,
            (before_joining.held IS NOT NULL) AS before_joining
       FROM books b
       JOIN sessions s ON s.book_id = b.id AND s.retired_at IS NULL
       LEFT JOIN programs pr ON pr.id = b.program_id
       LEFT JOIN LATERAL (
         -- The night they covered it. The earliest one, so a corrected sheet
         -- cannot move the date they first did the session.
         SELECT to_char(min(m.date), 'YYYY-MM-DD') AS date
           FROM completions c
           JOIN meetings m ON m.id = c.meeting_id
          WHERE c.owner_id = $1
            AND c.person_id = $2
            AND c.session_id = s.id
            AND m.status <> 'cancelled'
       ) covered ON true
       LEFT JOIN LATERAL (
         -- #28: their own BGroup held this one before they joined it.
         SELECT 1 AS held
           FROM home
           JOIN meetings hm ON hm.group_id = home.group_id AND hm.session_id = s.id
          WHERE hm.owner_id = $1
            AND hm.status = 'held'
            AND home.joined_on IS NOT NULL
            AND hm.date < home.joined_on
          LIMIT 1
       ) before_joining ON true
      WHERE EXISTS (SELECT 1 FROM home)
        AND (b.program_id IS NOT NULL
             OR covered.date IS NOT NULL
             OR b.id = (SELECT g.current_book_id FROM groups g, home WHERE g.id = home.group_id))
      ORDER BY pr.position ASC NULLS LAST,
               b.number ASC NULLS LAST,
               b.created_at ASC,
               s.number ASC`,
    [ownerId, personId],
  );

  const books: BookProgress[] = [];

  for (const row of rows) {
    let book = books[books.length - 1];
    if (book === undefined || book.bookId !== row.book_id) {
      book = {
        bookId: row.book_id,
        bookNumber: row.book_number,
        bookTitle: row.book_title,
        sessions: [],
        coveredCount: 0,
        sessionCount: 0,
        complete: false,
        joinedAtSessionNumber: null,
      };
      books.push(book);
    }

    book.sessions.push({
      sessionId: row.session_id,
      number: row.session_number,
      title: row.session_title,
      covered: row.covered_date !== null,
      date: row.covered_date,
      beforeJoining: row.before_joining,
    });
  }

  return books.map(summarise);
}

/**
 * The BGroup's current book, its own coverage of it, and every member against
 * it — the GroupDetail card, the member rows, and the advance checkpoint, from
 * one read.
 *
 * NULL when the group has no book yet (#17): there is no progress through a
 * book nobody has chosen.
 *
 * "Covered by the group" is a held night on that session (#47) — the group's
 * own history, not a second kind of completion. It is deliberately not "every
 * member covered it": the board's line says *both* halves, and they answer
 * different questions ("did we do it?" and "who has it?").
 */
export async function getGroupBookProgress(
  ownerId: string,
  groupId: string,
): Promise<GroupBookProgress | null> {
  if (!UUID_PATTERN.test(groupId)) return null;

  const sessionRows = await query<{
    book_id: string;
    book_number: number | null;
    book_title: string;
    session_id: string;
    session_number: number;
    session_title: string;
    covered_by_group: boolean;
  }>(
    `SELECT b.id AS book_id,
            b.number AS book_number,
            b.title AS book_title,
            s.id AS session_id,
            s.number AS session_number,
            s.title AS session_title,
            EXISTS (
              SELECT 1 FROM meetings m
               WHERE m.owner_id = $1
                 AND m.group_id = g.id
                 AND m.session_id = s.id
                 AND m.status = 'held'
            ) AS covered_by_group
       FROM groups g
       JOIN books b ON b.id = g.current_book_id
       JOIN sessions s ON s.book_id = b.id AND s.retired_at IS NULL
      WHERE g.owner_id = $1 AND g.id = $2
      ORDER BY s.number ASC`,
    [ownerId, groupId],
  );

  if (sessionRows.length === 0) return null;

  const memberRows = await query<{
    person_id: string;
    name: string;
    session_number: number;
    covered: boolean;
    before_joining: boolean;
  }>(
    `SELECT p.id AS person_id,
            p.name,
            s.number AS session_number,
            EXISTS (
              SELECT 1
                FROM completions c
                JOIN meetings cm ON cm.id = c.meeting_id
               WHERE c.owner_id = $1
                 AND c.person_id = p.id
                 AND c.session_id = s.id
                 AND cm.status <> 'cancelled'
            ) AS covered,
            EXISTS (
              SELECT 1 FROM meetings hm
               WHERE hm.owner_id = $1
                 AND hm.group_id = g.id
                 AND hm.session_id = s.id
                 AND hm.status = 'held'
                 AND gm.joined_on IS NOT NULL
                 AND hm.date < gm.joined_on
            ) AS before_joining
       FROM groups g
       JOIN people p
         ON p.owner_id = $1 AND p.home_group_id = g.id AND p.removed_at IS NULL
       LEFT JOIN group_memberships gm
         ON gm.person_id = p.id AND gm.group_id = g.id AND gm.ended_on IS NULL
       JOIN sessions s ON s.book_id = g.current_book_id AND s.retired_at IS NULL
      WHERE g.owner_id = $1 AND g.id = $2
      ORDER BY lower(p.name) ASC, s.number ASC`,
    [ownerId, groupId],
  );

  const sessions = sessionRows.map((row) => ({
    sessionId: row.session_id,
    number: row.session_number,
    title: row.session_title,
    coveredByGroup: row.covered_by_group,
  }));
  const coveredByGroup = new Set(
    sessions.filter((session) => session.coveredByGroup).map((session) => session.number),
  );

  const members: MemberProgress[] = [];
  /** #28, gathered as the rows go by: who arrived after something had run. */
  const joinedLate = new Set<string>();
  const firstAvailable = new Map<string, number>();

  for (const row of memberRows) {
    let member = members[members.length - 1];
    if (member === undefined || member.personId !== row.person_id) {
      member = {
        personId: row.person_id,
        name: row.name,
        coveredCount: 0,
        sessionCount: sessions.length,
        complete: false,
        behind: false,
        missingSessionNumbers: [],
        joinedAtSessionNumber: null,
      };
      members.push(member);
    }

    if (row.covered) {
      member.coveredCount += 1;
    } else {
      member.missingSessionNumbers.push(row.session_number);
      // Behind is measured against what the group has already done, not against
      // the whole book: everyone is short of a book the group is halfway
      // through, and nobody is behind for it.
      if (coveredByGroup.has(row.session_number)) member.behind = true;
    }

    if (row.before_joining) joinedLate.add(row.person_id);
    if (!row.before_joining) firstAvailable.set(
      row.person_id,
      firstAvailable.get(row.person_id) ?? row.session_number,
    );
  }

  for (const member of members) {
    member.complete = member.sessionCount > 0 && member.coveredCount === member.sessionCount;
    member.joinedAtSessionNumber = joinedLate.has(member.personId)
      ? // Past the end of the book when every session ran without them — the
        // marker still has something to say, and the line that prints it
        // decides what (`joinedAtLine`).
        (firstAvailable.get(member.personId) ?? member.sessionCount + 1)
      : null;
  }

  return {
    bookId: sessionRows[0].book_id,
    bookNumber: sessionRows[0].book_number,
    bookTitle: sessionRows[0].book_title,
    sessions,
    sessionCount: sessions.length,
    coveredByGroupCount: coveredByGroup.size,
    groupComplete: sessions.length > 0 && coveredByGroup.size === sessions.length,
    members,
    completeMemberCount: members.filter((member) => member.complete).length,
  };
}

/**
 * The advance checkpoint's list (#18): the members who have not finished the
 * outgoing book, in the order the members are already drawn in.
 *
 * Strict (#5), so "not finished" is one missing session as much as five — and
 * nobody is dropped from it for having joined late (#28). The marker travels
 * with them instead.
 */
export function leftBehind(progress: GroupBookProgress): MemberProgress[] {
  return progress.members.filter((member) => !member.complete);
}

/** The counts and #28's marker, once a book's sessions are all in hand. */
function summarise(book: BookProgress): BookProgress {
  const coveredCount = book.sessions.filter((session) => session.covered).length;
  const joinedLate = book.sessions.some((session) => session.beforeJoining);
  const firstAvailable = book.sessions.find((session) => !session.beforeJoining);

  return {
    ...book,
    coveredCount,
    sessionCount: book.sessions.length,
    complete: book.sessions.length > 0 && coveredCount === book.sessions.length,
    joinedAtSessionNumber: joinedLate
      ? (firstAvailable?.number ?? book.sessions.length + 1)
      : null,
  };
}
