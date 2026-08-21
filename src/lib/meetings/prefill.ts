/**
 * What the new-meeting form starts filled in with (#53).
 *
 * The rule is one sentence and the whole of it matters: **the group's current
 * book, and the session after that group's last HELD meeting**. This is the
 * group's *agenda*, never anyone's progress (#2) — a member who missed three
 * nights is behind, and the group still moves on. Their catch-up is the
 * attendance screen's job (#31), not this form's.
 *
 * Two consequences that are easy to get wrong:
 *
 * - A *proposed* meeting moves nothing. Held means it happened (#47), and a
 *   night scheduled for next week has not.
 * - A no-session fellowship night (#26) moves nothing either: it records
 *   contact, not coverage, so the agenda is still whatever the last night with
 *   a session covered.
 */
import type { CurriculumSession } from "../curriculum/books";
import { query } from "../db";

export type MeetingPrefill = {
  groupId: string;
  /** NULL while a group has no book chosen yet (#17). */
  bookId: string | null;
  bookNumber: number | null;
  bookTitle: string | null;
  /** Every session of that book, in published order — the form's session list. */
  sessions: CurriculumSession[];
  /** NULL when the book is finished, or when there is no book. */
  sessionId: string | null;
  sessionNumber: number | null;
  /** The group's own hour, which the night inherits and may override (#36). */
  startTime: string;
  durationMinutes: number;
};

/** A group as the picker's card draws it (#63), its agenda included. */
export type PickerGroup = {
  id: string;
  name: string;
  weekday: number;
  /** `HH:MM:SS`, as Postgres hands `time` back. */
  startTime: string;
  durationMinutes: number;
  memberCount: number;
  currentBookId: string | null;
  currentBookNumber: number | null;
  currentBookTitle: string | null;
  /** `YYYY-MM-DD` of the last held meeting; NULL for a group that has never met. */
  lastHeldDate: string | null;
  /** The agenda this group's next meeting starts on (#53). */
  prefill: MeetingPrefill;
};

/**
 * The session that follows `lastCoveredNumber` — pure, so the rule can be read
 * without a database. A finished book yields null: #4 makes choosing the next
 * book a deliberate checkpoint, and guessing at it here would skip it.
 */
export function nextSession(
  sessions: CurriculumSession[],
  lastCoveredNumber: number | null,
): CurriculumSession | null {
  const wanted = (lastCoveredNumber ?? 0) + 1;
  return sessions.find((session) => session.number === wanted) ?? null;
}

/**
 * Null for a group that cannot take a meeting at all: someone else's, gone, or
 * archived (#60) — the same three misses the picker already keeps off screen.
 */
export async function getMeetingPrefill(
  ownerId: string,
  groupId: string,
): Promise<MeetingPrefill | null> {
  const groups = await query<{
    id: string;
    start_time: string;
    duration_minutes: number;
    current_book_id: string | null;
    book_number: number | null;
    book_title: string | null;
  }>(
    `SELECT g.id,
            g.start_time,
            g.duration_minutes,
            g.current_book_id,
            b.number AS book_number,
            b.title AS book_title
       FROM groups g
       LEFT JOIN books b ON b.id = g.current_book_id
      WHERE g.owner_id = $1 AND g.id = $2 AND g.archived_at IS NULL`,
    [ownerId, groupId],
  );

  const group = groups[0];
  if (!group) return null;

  const base = {
    groupId: group.id,
    bookId: group.current_book_id,
    bookNumber: group.book_number,
    bookTitle: group.book_title,
    startTime: group.start_time,
    durationMinutes: group.duration_minutes,
  };

  if (group.current_book_id === null) {
    return { ...base, sessions: [], sessionId: null, sessionNumber: null };
  }

  const [sessions, lastCovered] = await Promise.all([
    query<CurriculumSession>(
      "SELECT id, number, title FROM sessions WHERE book_id = $1 ORDER BY number ASC",
      [group.current_book_id],
    ),
    lastCoveredSessionNumber(ownerId, groupId, group.current_book_id),
  ]);

  const session = nextSession(sessions, lastCovered);

  return {
    ...base,
    sessions,
    sessionId: session?.id ?? null,
    sessionNumber: session?.number ?? null,
  };
}

/**
 * The session number the group's most recent held meeting covered, in the book
 * it is on now. Meetings on an earlier book are not "the last held meeting" for
 * this purpose — the group has moved on (#17) and its agenda restarts.
 */
async function lastCoveredSessionNumber(
  ownerId: string,
  groupId: string,
  bookId: string,
): Promise<number | null> {
  const rows = await query<{ number: number }>(
    `SELECT s.number
       FROM meetings m
       JOIN sessions s ON s.id = m.session_id
      WHERE m.owner_id = $1
        AND m.group_id = $2
        AND m.book_id = $3
        AND m.status = 'held'
      ORDER BY m.date DESC, m.start_time DESC, m.created_at DESC
      LIMIT 1`,
    [ownerId, groupId, bookId],
  );

  return rows[0]?.number ?? null;
}

/**
 * The groups the [+] sheet can offer, already in #63's order: by last HELD
 * meeting, most recent first, never-met groups last, archived ones not at all
 * (#60).
 *
 * Every card's prefill is loaded, not just the selected one's — the picker
 * rewrites the whole agenda below it, and a round trip per tap would make the
 * form feel like a website.
 */
export async function listPickerGroups(ownerId: string): Promise<PickerGroup[]> {
  const rows = await query<{
    id: string;
    name: string;
    weekday: number;
    start_time: string;
    duration_minutes: number;
    member_count: number;
    current_book_id: string | null;
    current_book_number: number | null;
    current_book_title: string | null;
    last_held_date: string | null;
  }>(
    `SELECT g.id,
            g.name,
            g.weekday,
            g.start_time,
            g.duration_minutes,
            (SELECT count(*) FROM people p WHERE p.home_group_id = g.id)::int AS member_count,
            g.current_book_id,
            b.number AS current_book_number,
            b.title AS current_book_title,
            (SELECT to_char(max(m.date), 'YYYY-MM-DD')
               FROM meetings m
              WHERE m.group_id = g.id AND m.status = 'held') AS last_held_date
       FROM groups g
       LEFT JOIN books b ON b.id = g.current_book_id
      WHERE g.owner_id = $1 AND g.archived_at IS NULL
      -- Never-met groups sort last (#63), and two groups met on the same day
      -- fall back to their names rather than to whatever order the plan gave.
      ORDER BY last_held_date DESC NULLS LAST, lower(g.name) ASC`,
    [ownerId],
  );

  const cards = await Promise.all(
    rows.map(async (row) => {
      // One implementation of #53, shared with the single-group path the
      // calendar's ghost tap will use, rather than a second one in SQL here
      // that could drift from it. Null means the group was archived between
      // the two reads — #60 says it is no longer offered.
      const prefill = await getMeetingPrefill(ownerId, row.id);
      if (prefill === null) return null;

      return {
        id: row.id,
        name: row.name,
        weekday: row.weekday,
        startTime: row.start_time,
        durationMinutes: row.duration_minutes,
        memberCount: row.member_count,
        currentBookId: row.current_book_id,
        currentBookNumber: row.current_book_number,
        currentBookTitle: row.current_book_title,
        lastHeldDate: row.last_held_date,
        prefill,
      };
    }),
  );

  return cards.filter((card): card is PickerGroup => card !== null);
}
