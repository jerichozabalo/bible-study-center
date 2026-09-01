/**
 * BGroups (#66 — the word is BGroup, never DGroup).
 *
 * A group carries three things nothing else does: the weekly schedule (#36,
 * one recurrence per group per #48), the current book (#17 — there is no
 * enrolment entity, #16), and whether it is archived (#27 — archived, never
 * deleted; #60 keeps archived groups out of every picker).
 *
 * Every function takes the owner's address and scopes to it. v1 has exactly one
 * leader (#1), so this changes nothing today — it is #32's hook, and the reason
 * v1.1's leader accounts will not have to retrofit scoping onto live data.
 *
 * The functions validate and throw `RosterValidationError`; the server actions
 * above them turn that into a sentence on the form and let everything else — a
 * dropped connection, a constraint nobody expected — surface as the error it is.
 */
import { query, transaction } from "../db";
import { moveMembership } from "./memberships";

/** Something the leader typed cannot be saved, and the message says why. */
export class RosterValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RosterValidationError";
  }
}

export type GroupInput = {
  name: string;
  /** 0 = Sunday (#46). */
  weekday: number;
  /** `HH:MM`, local wall clock, `Asia/Manila` semantics (#56). */
  startTime: string;
  durationMinutes: number;
  /** Optional: a group can exist before its first book is chosen. */
  currentBookId: string | null;
};

export type GroupSummary = {
  id: string;
  name: string;
  weekday: number;
  /** Postgres hands `time` back as `HH:MM:SS`. */
  startTime: string;
  durationMinutes: number;
  currentBookId: string | null;
  currentBookNumber: number | null;
  currentBookTitle: string | null;
  currentBookSessionCount: number;
  memberCount: number;
  /** NULL while the group is live (#27). */
  archivedAt: Date | null;
  createdAt: Date;
};

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SELECT_GROUP = `
  SELECT g.id,
         g.name,
         g.weekday,
         g.start_time,
         g.duration_minutes,
         g.current_book_id,
         b.number AS current_book_number,
         b.title AS current_book_title,
         COALESCE((SELECT count(*) FROM sessions s WHERE s.book_id = b.id), 0)::int
           AS current_book_session_count,
         (SELECT count(*) FROM people p WHERE p.home_group_id = g.id)::int AS member_count,
         g.archived_at,
         g.created_at
    FROM groups g
    LEFT JOIN books b ON b.id = g.current_book_id
`;

/** Live groups, alphabetically — the Groups segment of the People tab. */
export async function listGroups(ownerId: string): Promise<GroupSummary[]> {
  const rows = await query<GroupRow>(
    `${SELECT_GROUP} WHERE g.owner_id = $1 AND g.archived_at IS NULL ORDER BY lower(g.name) ASC`,
    [ownerId],
  );
  return rows.map(toSummary);
}

/** Archived groups, most recently archived first (#27 — they are never deleted). */
export async function listArchivedGroups(ownerId: string): Promise<GroupSummary[]> {
  const rows = await query<GroupRow>(
    `${SELECT_GROUP} WHERE g.owner_id = $1 AND g.archived_at IS NOT NULL
      ORDER BY g.archived_at DESC`,
    [ownerId],
  );
  return rows.map(toSummary);
}

export async function getGroup(ownerId: string, id: string): Promise<GroupSummary | null> {
  if (!UUID_PATTERN.test(id)) return null;

  const rows = await query<GroupRow>(`${SELECT_GROUP} WHERE g.owner_id = $1 AND g.id = $2`, [
    ownerId,
    id,
  ]);
  return rows[0] ? toSummary(rows[0]) : null;
}

export async function createGroup(ownerId: string, input: GroupInput): Promise<string> {
  const clean = await validate(input);

  const rows = await query<{ id: string }>(
    `INSERT INTO groups (owner_id, name, weekday, start_time, duration_minutes, current_book_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      ownerId,
      clean.name,
      clean.weekday,
      clean.startTime,
      clean.durationMinutes,
      clean.currentBookId,
    ],
  );

  return rows[0].id;
}

export async function updateGroup(
  ownerId: string,
  id: string,
  input: GroupInput,
): Promise<void> {
  const clean = await validate(input);

  // `archived_at IS NULL` is the rule, and it lives in the statement rather
  // than in a screen. The detail page stops offering Edit once a group is
  // archived, but that only hides a control — `/people/groups/<id>/edit` was
  // still answering 200 with a prefilled form, and the save went through (QA
  // pass, 2026-08-21). An archived group proposes no meetings and cannot be
  // picked (#60); letting its schedule be rewritten from a stale tab or a
  // bookmarked URL is the same class of surprise.
  const rows = await query<{ id: string }>(
    `UPDATE groups
        SET name = $3,
            weekday = $4,
            start_time = $5,
            duration_minutes = $6,
            current_book_id = $7,
            updated_at = now()
      WHERE owner_id = $1 AND id = $2 AND archived_at IS NULL
      RETURNING id`,
    [
      ownerId,
      id,
      clean.name,
      clean.weekday,
      clean.startTime,
      clean.durationMinutes,
      clean.currentBookId,
    ],
  );

  if (rows.length === 0) {
    // One message for both misses. Whether the row is gone or archived, the
    // honest answer to "why did my edit not save" is the same, and the caller
    // that needs to tell them apart (the edit screen) reads the group first.
    throw new RosterValidationError("That BGroup is archived or no longer exists.");
  }
}

/**
 * Move the group to another book — the write behind "Advance anyway" (#4/#18).
 *
 * Deliberately the smallest statement in this file. The group carries the book
 * (#17) and there is no enrolment entity (#16), so advancing is one column:
 * nobody is enrolled, no completion is written or taken away (#5 — a member's
 * progress is theirs and does not reset), and #28's joined-at markers keep
 * naming the book each member actually arrived on.
 *
 * It is not `updateGroup` with the other fields left alone, because the
 * checkpoint screen has no schedule to post and re-posting one is how a stale
 * form quietly rewrites a group's night.
 *
 * Who is left behind, and whether to ask first, is the screen's question —
 * `insights/progress` answers it. This refuses nothing but a book that does not
 * exist and a group that is archived (#60).
 */
export async function setCurrentBook(
  ownerId: string,
  id: string,
  bookId: string,
): Promise<void> {
  if (!UUID_PATTERN.test(bookId)) {
    throw new RosterValidationError("That book is not in the curriculum.");
  }

  const book = await query<{ id: string }>("SELECT id FROM books WHERE id = $1", [bookId]);
  if (book.length === 0) {
    throw new RosterValidationError("That book is not in the curriculum.");
  }

  const rows = await query<{ id: string }>(
    `UPDATE groups
        SET current_book_id = $3, updated_at = now()
      WHERE owner_id = $1 AND id = $2 AND archived_at IS NULL
      RETURNING id`,
    [ownerId, id, bookId],
  );

  if (rows.length === 0) {
    throw new RosterValidationError("That BGroup is archived or no longer exists.");
  }
}

/**
 * Archive a group, optionally moving its members somewhere else first (#27).
 *
 * The move is an offer, not a rule: declining it leaves the members pointing at
 * the archived group, which is the truth about where they were. Both halves run
 * in one transaction, so a refused destination cannot leave the group archived
 * with its members stranded.
 */
export async function archiveGroup(
  ownerId: string,
  id: string,
  options: { moveMembersToGroupId?: string | null } = {},
): Promise<void> {
  const destination = options.moveMembersToGroupId ?? null;

  if (destination !== null && destination === id) {
    throw new RosterValidationError("Pick a different BGroup to move the members to.");
  }

  await transaction(async (tx) => {
    if (destination !== null) {
      const live = await tx.query<{ id: string }>(
        "SELECT id FROM groups WHERE owner_id = $1 AND id = $2 AND archived_at IS NULL",
        [ownerId, destination],
      );
      if (live.length === 0) {
        // #60: an archived group cannot receive members any more than it can be
        // picked for a meeting.
        throw new RosterValidationError("Pick a BGroup that is still running.");
      }

      const moving = await tx.query<{ id: string }>(
        `UPDATE people SET home_group_id = $1, updated_at = now()
          WHERE home_group_id = $2 AND owner_id = $3
          RETURNING id`,
        [destination, id, ownerId],
      );

      // A bulk move is a transfer, so it leaves the same trail one does (#28):
      // without this, a moved member's marker keeps naming the BGroup they are
      // no longer in, and "joined mid-book" would be read against the wrong
      // book. One statement per person — the members of one BGroup, not the
      // roster.
      for (const person of moving) {
        await moveMembership(tx, ownerId, person.id, destination);
      }
    }

    // `archived_at IS NULL` keeps the first archiving date when this is run
    // twice — the Groups screen prints that date.
    await tx.query(
      `UPDATE groups SET archived_at = now(), updated_at = now()
        WHERE owner_id = $1 AND id = $2 AND archived_at IS NULL`,
      [ownerId, id],
    );
  });
}

/**
 * Bring an archived group back (#27 leaves the reverse unwritten — see issue 14).
 *
 * The mirror of `archiveGroup`, and deliberately smaller than it. Archiving is
 * the destructive direction, so it asks a question first; this one undoes a
 * mis-tap and asks nothing.
 *
 * It does NOT undo #27's bulk move. If the members were sent elsewhere, that is
 * where they live now, and pulling them back would be a second surprise on top
 * of the one this is fixing — the group comes back empty and the detail page
 * says so. Nothing about history changes in either direction (#24).
 *
 * `archived_at IS NOT NULL` matches the guard on the way in: the statement is
 * the rule, so a live group is a no-op rather than a fresh `updated_at`.
 */
export async function unarchiveGroup(ownerId: string, id: string): Promise<void> {
  await query(
    `UPDATE groups SET archived_at = NULL, updated_at = now()
      WHERE owner_id = $1 AND id = $2 AND archived_at IS NOT NULL`,
    [ownerId, id],
  );
}

type GroupRow = {
  id: string;
  name: string;
  weekday: number;
  start_time: string;
  duration_minutes: number;
  current_book_id: string | null;
  current_book_number: number | null;
  current_book_title: string | null;
  current_book_session_count: number;
  member_count: number;
  archived_at: Date | null;
  created_at: Date;
};

function toSummary(row: GroupRow): GroupSummary {
  return {
    id: row.id,
    name: row.name,
    weekday: row.weekday,
    startTime: row.start_time,
    durationMinutes: row.duration_minutes,
    currentBookId: row.current_book_id,
    currentBookNumber: row.current_book_number,
    currentBookTitle: row.current_book_title,
    currentBookSessionCount: row.current_book_session_count,
    memberCount: row.member_count,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
  };
}

async function validate(input: GroupInput): Promise<GroupInput> {
  const name = input.name.trim();
  if (name.length === 0) throw new RosterValidationError("A BGroup needs a name.");

  if (!Number.isInteger(input.weekday) || input.weekday < 0 || input.weekday > 6) {
    throw new RosterValidationError("Pick the day this BGroup meets.");
  }

  if (!TIME_PATTERN.test(input.startTime)) {
    throw new RosterValidationError("Pick the time this BGroup starts.");
  }

  if (
    !Number.isInteger(input.durationMinutes) ||
    input.durationMinutes < 1 ||
    input.durationMinutes > 24 * 60
  ) {
    throw new RosterValidationError("Set how long the BGroup runs, in minutes.");
  }

  const currentBookId = input.currentBookId || null;
  if (currentBookId !== null) {
    // Checked here rather than left to the foreign key, so a stale picker gets
    // a sentence instead of a constraint name.
    if (!UUID_PATTERN.test(currentBookId)) {
      throw new RosterValidationError("That book is not in the curriculum.");
    }
    const book = await query<{ id: string }>("SELECT id FROM books WHERE id = $1", [currentBookId]);
    if (book.length === 0) {
      throw new RosterValidationError("That book is not in the curriculum.");
    }
  }

  return { name, weekday: input.weekday, startTime: input.startTime, durationMinutes: input.durationMinutes, currentBookId };
}
