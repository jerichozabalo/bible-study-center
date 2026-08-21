/**
 * #28's joined-at markers — one row per stretch of membership in a BGroup.
 *
 * Its own module because both halves of the roster write them: a person's own
 * transfer (`people.ts`) and #27's bulk move when a BGroup is archived
 * (`groups.ts`). A helper living in either one would make the other import it
 * in a circle.
 *
 * What the marker is for: one home group at a time (#15), so "which group" is
 * a column on the person. What that column cannot say is *since when*, and
 * which book the group was on the day they arrived — which is the difference
 * between a mid-book joiner who is behind and one who is merely new (#28).
 */
import { type TransactionClient, query } from "../db";
import { manilaToday } from "../dates";

export type Membership = {
  id: string;
  groupId: string;
  groupName: string;
  groupArchivedAt: Date | null;
  joinedOn: string;
  /** The book the group was on that day; NULL if it had not chosen one yet. */
  bookId: string | null;
  bookNumber: number | null;
  bookTitle: string | null;
  /** NULL = this is where they are now. */
  endedOn: string | null;
};

/**
 * Close the open marker and open one on the new group.
 *
 * The old row is ended, never deleted (#24): "she was in Tuesday BGroup from
 * June to August" is the history a transfer must leave behind.
 */
export async function moveMembership(
  tx: TransactionClient,
  ownerId: string,
  personId: string,
  groupId: string | null,
): Promise<void> {
  const today = manilaToday();

  await tx.query(
    `UPDATE group_memberships SET ended_on = $2 WHERE person_id = $1 AND ended_on IS NULL`,
    [personId, today],
  );

  if (groupId !== null) await openMembership(tx, ownerId, personId, groupId, today);
}

/**
 * The first marker, dated the day they joined rather than the day the record
 * was typed — a person entered a week late still joined when they joined.
 *
 * The book comes from the group as it stands, in the same statement, so there
 * is no read-then-write gap to get wrong.
 */
export async function openMembership(
  tx: TransactionClient,
  ownerId: string,
  personId: string,
  groupId: string,
  joinedOn: string,
): Promise<void> {
  await tx.query(
    `INSERT INTO group_memberships (owner_id, person_id, group_id, joined_on, joined_at_book_id)
     SELECT $1, $2, g.id, $4, g.current_book_id FROM groups g WHERE g.id = $3`,
    [ownerId, personId, groupId, joinedOn],
  );
}

/** Everywhere this person has belonged, newest first. */
export async function listMemberships(personId: string): Promise<Membership[]> {
  const rows = await query<{
    id: string;
    group_id: string;
    group_name: string;
    group_archived_at: Date | null;
    joined_on: string;
    book_id: string | null;
    book_number: number | null;
    book_title: string | null;
    ended_on: string | null;
  }>(
    `SELECT m.id,
            m.group_id,
            g.name AS group_name,
            g.archived_at AS group_archived_at,
            m.joined_on::text AS joined_on,
            m.joined_at_book_id AS book_id,
            b.number AS book_number,
            b.title AS book_title,
            m.ended_on::text AS ended_on
       FROM group_memberships m
       JOIN groups g ON g.id = m.group_id
       LEFT JOIN books b ON b.id = m.joined_at_book_id
      WHERE m.person_id = $1
      ORDER BY m.joined_on DESC, m.created_at DESC`,
    [personId],
  );

  return rows.map((row) => ({
    id: row.id,
    groupId: row.group_id,
    groupName: row.group_name,
    groupArchivedAt: row.group_archived_at,
    joinedOn: row.joined_on,
    bookId: row.book_id,
    bookNumber: row.book_number,
    bookTitle: row.book_title,
    endedOn: row.ended_on,
  }));
}
