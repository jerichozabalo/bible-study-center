/**
 * Catch-up matching (#31) — the same derived relationship, read from both ends.
 *
 * `getCatchUpCandidates` answers the sheet's question: **who could ride along
 * tonight?** `getCatchUpTargets` answers the person's: **where could they fill
 * a gap?** Both are computed, never stored — a "catch-up" is not a record, it
 * is what the absence of a completion means on a night that covers a session.
 *
 * Three rules the log is explicit about, because each has a tempting wrong
 * answer:
 *
 * 1. **That exact book+session, not "anyone behind" (#31).** Both alternatives
 *    were rejected by name: a list of everybody who is behind, and the quiet
 *    list (#10/#64) reused as candidates. Tonight covers one session; the only
 *    people it can help are the ones missing that one.
 * 2. **Missing means no CREDITING completion.** The same two filters
 *    `listCoveredSessions` applies: a cancelled night never happened (#50), and
 *    a retired session (005) no longer counts toward its book — so neither can
 *    take anyone off this list. 'present-only' credits nothing either (#25/#65).
 * 3. **The completion credits the PERSON (#31).** Riding along at another
 *    BGroup is what removes someone from their own BGroup's catch-up list; the
 *    host's history keeps the visit, and no group count moves.
 *
 * #28's joined-at marker travels with every candidate rather than filtering it:
 * someone who joined halfway through the book is genuinely behind, and the
 * marker is what stops the list reading as a pile of failures.
 */
import { isCalendarDate, manilaToday } from "../dates";
import { query } from "../db";

/** Someone from another BGroup who is missing the session a meeting covers. */
export type CatchUpCandidate = {
  personId: string;
  name: string;
  /** Always their own BGroup, and never the meeting's — that is the point. */
  homeGroupId: string;
  homeGroupName: string;
  /** #28 — the day they joined that BGroup. NULL if no marker was ever opened. */
  joinedOn: string | null;
  /** #28 — the book their BGroup was on that day; NULL if it had none. */
  joinedAtBookNumber: number | null;
  joinedAtBookTitle: string | null;
};

/** An upcoming night that covers a session this person is missing. */
export type CatchUpTarget = {
  sessionId: string;
  sessionNumber: number;
  sessionTitle: string;
  bookId: string;
  bookNumber: number | null;
  bookTitle: string;
  meetingId: string;
  groupId: string;
  groupName: string;
  /** `YYYY-MM-DD`, local (#56). */
  date: string;
  /** Postgres hands `time` back as `HH:MM:SS`. */
  startTime: string;
  /** Their own BGroup is hosting it, so filling the gap is not a visit. */
  ownGroup: boolean;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The people a meeting's sheet can offer as ride-alongs, alphabetically.
 *
 * Empty for anything that cannot help anyone: a fellowship night (#26) covers
 * no session, a cancelled night (#50) is not happening, and a retired session
 * credits nothing. Anyone this sheet already records is left out — they are on
 * it, which is the state this list exists to produce.
 *
 * Stepped-away people (#10/#66) are left out too: the leader has said they are
 * not coming for now, and the quiet list already stops asking about them.
 */
export async function getCatchUpCandidates(
  ownerId: string,
  meetingId: string,
): Promise<CatchUpCandidate[]> {
  if (!UUID_PATTERN.test(meetingId)) return [];

  const rows = await query<{
    person_id: string;
    name: string;
    home_group_id: string;
    home_group_name: string;
    joined_on: string | null;
    joined_at_book_number: number | null;
    joined_at_book_title: string | null;
  }>(
    `WITH night AS (
       SELECT m.id, m.group_id, m.session_id
         FROM meetings m
         JOIN sessions s ON s.id = m.session_id
        WHERE m.owner_id = $1
          AND m.id = $2
          AND m.status <> 'cancelled'
          AND s.retired_at IS NULL
     )
     SELECT p.id AS person_id,
            p.name,
            p.home_group_id,
            g.name AS home_group_name,
            gm.joined_on::text AS joined_on,
            b.number AS joined_at_book_number,
            b.title AS joined_at_book_title
       FROM night
       JOIN people p
         ON p.owner_id = $1
        AND p.home_group_id IS NOT NULL
        AND p.home_group_id <> night.group_id
        AND p.removed_at IS NULL
        AND p.stepped_away_on IS NULL
       JOIN groups g ON g.id = p.home_group_id
       LEFT JOIN group_memberships gm
         ON gm.person_id = p.id AND gm.group_id = p.home_group_id AND gm.ended_on IS NULL
       LEFT JOIN books b ON b.id = gm.joined_at_book_id
      WHERE NOT EXISTS (
              SELECT 1
                FROM completions c
                JOIN meetings cm ON cm.id = c.meeting_id
               WHERE c.owner_id = $1
                 AND c.person_id = p.id
                 AND c.session_id = night.session_id
                 AND cm.status <> 'cancelled'
            )
        AND NOT EXISTS (
              SELECT 1
                FROM completions here
               WHERE here.owner_id = $1
                 AND here.person_id = p.id
                 AND here.meeting_id = night.id
            )
      ORDER BY lower(p.name) ASC`,
    [ownerId, meetingId],
  );

  return rows.map((row) => ({
    personId: row.person_id,
    name: row.name,
    homeGroupId: row.home_group_id,
    homeGroupName: row.home_group_name,
    joinedOn: row.joined_on,
    joinedAtBookNumber: row.joined_at_book_number,
    joinedAtBookTitle: row.joined_at_book_title,
  }));
}

/**
 * Where this person could fill a gap — one target per missing session, soonest
 * night first.
 *
 * Scoped to the book their own BGroup is on (#17): the group carries the book,
 * so that is the stretch they are being asked to keep up with. A session from a
 * book nobody has reached yet is not a gap.
 *
 * "Upcoming" is PROPOSED and dated today or later, read in Manila (#56) —
 * *held* means the night already happened (#47) and cancelled means it is not
 * (#50). `today` is a parameter so a test can stand somewhere in particular.
 */
export async function getCatchUpTargets(
  ownerId: string,
  personId: string,
  today: string = manilaToday(),
): Promise<CatchUpTarget[]> {
  if (!UUID_PATTERN.test(personId) || !isCalendarDate(today)) return [];

  const rows = await query<{
    session_id: string;
    session_number: number;
    session_title: string;
    book_id: string;
    book_number: number | null;
    book_title: string;
    meeting_id: string;
    group_id: string;
    group_name: string;
    date: string;
    start_time: string;
    own_group: boolean;
  }>(
    `WITH home AS (
       SELECT p.id AS person_id, p.home_group_id, g.current_book_id
         FROM people p
         JOIN groups g ON g.id = p.home_group_id
        WHERE p.owner_id = $1 AND p.id = $2 AND g.current_book_id IS NOT NULL
     ),
     gaps AS (
       SELECT s.id
         FROM home
         JOIN sessions s ON s.book_id = home.current_book_id
        WHERE s.retired_at IS NULL
          AND NOT EXISTS (
                SELECT 1
                  FROM completions c
                  JOIN meetings cm ON cm.id = c.meeting_id
                 WHERE c.owner_id = $1
                   AND c.person_id = home.person_id
                   AND c.session_id = s.id
                   AND cm.status <> 'cancelled'
              )
     )
     SELECT DISTINCT ON (s.id)
            s.id AS session_id,
            s.number AS session_number,
            s.title AS session_title,
            b.id AS book_id,
            b.number AS book_number,
            b.title AS book_title,
            m.id AS meeting_id,
            m.group_id,
            g.name AS group_name,
            to_char(m.date, 'YYYY-MM-DD') AS date,
            m.start_time,
            (m.group_id = home.home_group_id) AS own_group
       FROM home
       JOIN gaps ON true
       JOIN sessions s ON s.id = gaps.id
       JOIN books b ON b.id = s.book_id
       JOIN meetings m ON m.session_id = s.id
       JOIN groups g ON g.id = m.group_id
      WHERE m.owner_id = $1
        AND m.status = 'proposed'
        AND m.date >= $3::date
      ORDER BY s.id, m.date ASC, m.start_time ASC`,
    [ownerId, personId, today],
  );

  return rows
    .map((row) => ({
      sessionId: row.session_id,
      sessionNumber: row.session_number,
      sessionTitle: row.session_title,
      bookId: row.book_id,
      bookNumber: row.book_number,
      bookTitle: row.book_title,
      meetingId: row.meeting_id,
      groupId: row.group_id,
      groupName: row.group_name,
      date: row.date,
      startTime: row.start_time,
      ownGroup: row.own_group,
    }))
    // `DISTINCT ON` fixes the order it de-duplicates in, so the soonest night
    // is chosen there and the list is put in the leader's order here.
    .sort((left, right) =>
      left.date === right.date
        ? left.sessionNumber - right.sessionNumber
        : left.date < right.date
          ? -1
          : 1,
    );
}
