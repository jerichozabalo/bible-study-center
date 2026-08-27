/**
 * Meetings — the dated nights a BGroup meets (#6/#7).
 *
 * Three rules from the decision log shape everything below:
 *
 * - **Creating always yields PROPOSED, whatever the date (#47).** There is no
 *   future/past split and nothing here can write 'held': *held* means someone
 *   took attendance, and that stays a deliberate act on the attendance screen.
 * - **Local date + local time, `Asia/Manila` semantics (#56).** Dates cross this
 *   boundary as `YYYY-MM-DD` strings and times as `HH:MM`, never as `Date`
 *   objects — the server runs in UTC and a round trip through one would move an
 *   evening meeting to the previous day.
 * - **Time and duration are inherited from the group and may be overridden for
 *   one night (#36)**, then written onto the row: changing the group's regular
 *   hour later must not rewrite what already happened (#24).
 *
 * `origin` is 'created' for everything here — the leader typed it. 'generated'
 * belongs to issue 5's materialiser, and #73's partial unique index is what
 * keeps that path idempotent without forbidding a same-day make-up meeting.
 */
import { weekdayOf } from "../dates";
import { query, transaction } from "../db";
import type { Schedule } from "../roster/schedule";
import { materializeScheduleInTx, shiftProposedMeetingsInTx } from "./calendar";

/** Something the leader typed cannot be saved, and the message says why. */
export class MeetingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MeetingValidationError";
  }
}

export type MeetingStatus = "proposed" | "held" | "cancelled";
export type MeetingOrigin = "generated" | "created";

export type MeetingInput = {
  groupId: string;
  /** `YYYY-MM-DD`, local wall-clock date, `Asia/Manila` semantics (#56). */
  date: string;
  /** `HH:MM`, or null to inherit the group's start time (#36). */
  startTime: string | null;
  /** Null to inherit the group's duration (#36). */
  durationMinutes: number | null;
  /** Optional — a fellowship night covers no session (#26). */
  bookId: string | null;
  sessionId: string | null;
  /** Free text, and where a moved venue lives (#54/#55). */
  notes: string | null;
  /** #48: this also sets the GROUP's schedule — there is one recurrence per group. */
  repeatWeekly: boolean;
};

export type MeetingSummary = {
  id: string;
  groupId: string;
  groupName: string;
  /** `YYYY-MM-DD` (#56). */
  date: string;
  /** Postgres hands `time` back as `HH:MM:SS`. */
  startTime: string;
  durationMinutes: number;
  bookId: string | null;
  bookNumber: number | null;
  bookTitle: string | null;
  sessionId: string | null;
  sessionNumber: number | null;
  sessionTitle: string | null;
  notes: string | null;
  status: MeetingStatus;
  origin: MeetingOrigin;
  ledBy: string;
  createdAt: Date;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SELECT_MEETING = `
  SELECT m.id,
         m.group_id,
         g.name AS group_name,
         to_char(m.date, 'YYYY-MM-DD') AS date,
         m.start_time,
         m.duration_minutes,
         m.book_id,
         b.number AS book_number,
         b.title AS book_title,
         m.session_id,
         s.number AS session_number,
         s.title AS session_title,
         m.notes,
         m.status,
         m.origin,
         m.led_by,
         m.created_at
    FROM meetings m
    JOIN groups g ON g.id = m.group_id
    LEFT JOIN books b ON b.id = m.book_id
    LEFT JOIN sessions s ON s.id = m.session_id
`;

export async function getMeeting(ownerId: string, id: string): Promise<MeetingSummary | null> {
  if (!UUID_PATTERN.test(id)) return null;

  const rows = await query<MeetingRow>(`${SELECT_MEETING} WHERE m.owner_id = $1 AND m.id = $2`, [
    ownerId,
    id,
  ]);
  return rows[0] ? toSummary(rows[0]) : null;
}

/**
 * The next meetings from a given local date onwards — Home's list.
 *
 * Cancelled nights are left out: the calendar shows them greyed and struck
 * through so an empty Sunday reads correctly (#50), but "what is next" is not a
 * place for a night that is not happening.
 */
export async function listUpcomingMeetings(
  ownerId: string,
  options: { from: string; limit?: number },
): Promise<MeetingSummary[]> {
  if (!DATE_PATTERN.test(options.from)) return [];

  const rows = await query<MeetingRow>(
    `${SELECT_MEETING}
      WHERE m.owner_id = $1 AND m.date >= $2::date AND m.status <> 'cancelled'
      ORDER BY m.date ASC, m.start_time ASC
      LIMIT $3`,
    [ownerId, options.from, options.limit ?? 5],
  );
  return rows.map(toSummary);
}

/**
 * Create the meeting the leader typed. Always PROPOSED (#47), always
 * `origin = 'created'` (#73), always stamped to them (#32).
 */
export async function createMeeting(ownerId: string, input: MeetingInput): Promise<string> {
  const group = await loadGroup(ownerId, input.groupId);
  const clean = await validate(input);

  // #36: the group's hour is the default, and an override applies to this night
  // only. Both are written onto the row — see the module note.
  const startTime = clean.startTime ?? group.start_time;
  const durationMinutes = clean.durationMinutes ?? group.duration_minutes;

  return transaction(async (tx) => {
    const rows = await tx.query<{ id: string }>(
      `INSERT INTO meetings
         (owner_id, led_by, group_id, date, start_time, duration_minutes, book_id, session_id,
          notes, status, origin)
       VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8, 'proposed', 'created')
       RETURNING id`,
      [
        ownerId,
        input.groupId,
        clean.date,
        startTime,
        durationMinutes,
        clean.bookId,
        clean.sessionId,
        clean.notes,
      ],
    );

    if (input.repeatWeekly) {
      // #48: the create form's recurring option sets the GROUP's schedule —
      // there is exactly one recurrence per group and this is one of the two
      // places it can be edited. Moving the group's already-proposed future
      // meetings onto the new day is #48b, which belongs to the materialiser.
      await writeSchedule(tx, ownerId, input.groupId, {
        weekday: weekdayOf(clean.date),
        startTime,
        durationMinutes,
      });
      // #48b/#49: shift existing future proposed meetings to the new day and
      // fill the 8-week horizon on the new schedule.
      await shiftProposedMeetingsInTx(tx, ownerId, input.groupId, weekdayOf(clean.date), startTime, durationMinutes);
      await materializeScheduleInTx(tx, ownerId, clean.date);
    }

    return rows[0].id;
  });
}

/**
 * Set a group's weekly schedule (#36/#48). The same write the create form's
 * recurring option makes, exposed for the group screens and for issue 5.
 */
export async function setGroupSchedule(
  ownerId: string,
  groupId: string,
  schedule: Schedule,
): Promise<void> {
  await loadGroup(ownerId, groupId);

  if (!Number.isInteger(schedule.weekday) || schedule.weekday < 0 || schedule.weekday > 6) {
    throw new MeetingValidationError("Pick the day this BGroup meets.");
  }
  if (!TIME_PATTERN.test(schedule.startTime)) {
    throw new MeetingValidationError("Pick the time this BGroup starts.");
  }
  if (
    !Number.isInteger(schedule.durationMinutes) ||
    schedule.durationMinutes < 1 ||
    schedule.durationMinutes > 24 * 60
  ) {
    throw new MeetingValidationError("Set how long the BGroup runs, in minutes.");
  }

  await transaction((tx) => writeSchedule(tx, ownerId, groupId, schedule));
}

type GroupRow = {
  id: string;
  weekday: number;
  start_time: string;
  duration_minutes: number;
  current_book_id: string | null;
};

type MeetingRow = {
  id: string;
  group_id: string;
  group_name: string;
  date: string;
  start_time: string;
  duration_minutes: number;
  book_id: string | null;
  book_number: number | null;
  book_title: string | null;
  session_id: string | null;
  session_number: number | null;
  session_title: string | null;
  notes: string | null;
  status: MeetingStatus;
  origin: MeetingOrigin;
  led_by: string;
  created_at: Date;
};

function toSummary(row: MeetingRow): MeetingSummary {
  return {
    id: row.id,
    groupId: row.group_id,
    groupName: row.group_name,
    date: row.date,
    startTime: row.start_time,
    durationMinutes: row.duration_minutes,
    bookId: row.book_id,
    bookNumber: row.book_number,
    bookTitle: row.book_title,
    sessionId: row.session_id,
    sessionNumber: row.session_number,
    sessionTitle: row.session_title,
    notes: row.notes,
    status: row.status,
    origin: row.origin,
    ledBy: row.led_by,
    createdAt: row.created_at,
  };
}

/**
 * The group this meeting is for, refusing anything the picker would not have
 * offered: someone else's group, one that is gone, or an archived one (#60).
 */
async function loadGroup(ownerId: string, groupId: string): Promise<GroupRow> {
  if (!UUID_PATTERN.test(groupId)) {
    throw new MeetingValidationError("Pick the BGroup this meeting is for.");
  }

  const rows = await query<GroupRow>(
    `SELECT id, weekday, start_time, duration_minutes, current_book_id
       FROM groups
      WHERE owner_id = $1 AND id = $2 AND archived_at IS NULL`,
    [ownerId, groupId],
  );

  if (rows.length === 0) {
    // One message for all three misses, the same way `updateGroup` answers a
    // stale screen: whichever it is, the BGroup cannot take a meeting.
    throw new MeetingValidationError("That BGroup is archived or no longer exists.");
  }
  return rows[0];
}

async function validate(input: MeetingInput): Promise<{
  date: string;
  startTime: string | null;
  durationMinutes: number | null;
  bookId: string | null;
  sessionId: string | null;
  notes: string | null;
}> {
  if (!isRealDate(input.date)) {
    throw new MeetingValidationError("Pick the date this meeting is on.");
  }

  if (input.startTime !== null && !TIME_PATTERN.test(input.startTime)) {
    throw new MeetingValidationError("Pick the time this meeting starts.");
  }

  if (
    input.durationMinutes !== null &&
    (!Number.isInteger(input.durationMinutes) ||
      input.durationMinutes < 1 ||
      input.durationMinutes > 24 * 60)
  ) {
    throw new MeetingValidationError("Set how long the meeting runs, in minutes.");
  }

  const { bookId, sessionId } = await validateLesson(input.bookId, input.sessionId);
  const notes = input.notes?.trim() ?? "";

  return {
    date: input.date,
    startTime: input.startTime,
    durationMinutes: input.durationMinutes,
    bookId,
    sessionId,
    notes: notes === "" ? null : notes,
  };
}

/**
 * Book and session, checked together. Either may be absent (#26), but a session
 * that is not in the book named beside it would make a held meeting claim
 * coverage of something it did not cover.
 */
async function validateLesson(
  bookId: string | null,
  sessionId: string | null,
): Promise<{ bookId: string | null; sessionId: string | null }> {
  if (sessionId === null) {
    if (bookId === null) return { bookId: null, sessionId: null };
    if (!UUID_PATTERN.test(bookId)) {
      throw new MeetingValidationError("That book is not in the curriculum.");
    }
    const book = await query<{ id: string }>("SELECT id FROM books WHERE id = $1", [bookId]);
    if (book.length === 0) {
      throw new MeetingValidationError("That book is not in the curriculum.");
    }
    return { bookId, sessionId: null };
  }

  if (!UUID_PATTERN.test(sessionId)) {
    throw new MeetingValidationError("That session is not in the curriculum.");
  }
  const rows = await query<{ book_id: string }>("SELECT book_id FROM sessions WHERE id = $1", [
    sessionId,
  ]);
  if (rows.length === 0) {
    throw new MeetingValidationError("That session is not in the curriculum.");
  }
  if (bookId !== null && bookId !== rows[0].book_id) {
    throw new MeetingValidationError("That session belongs to a different book.");
  }
  // A session names its own book, so a form that posted only the session still
  // records which book was covered.
  return { bookId: rows[0].book_id, sessionId };
}

async function writeSchedule(
  tx: { query<Row>(text: string, params?: unknown[]): Promise<Row[]> },
  ownerId: string,
  groupId: string,
  schedule: Schedule,
): Promise<void> {
  await tx.query(
    `UPDATE groups
        SET weekday = $3, start_time = $4, duration_minutes = $5, updated_at = now()
      WHERE owner_id = $1 AND id = $2 AND archived_at IS NULL`,
    [ownerId, groupId, schedule.weekday, schedule.startTime, schedule.durationMinutes],
  );
}

/**
 * `YYYY-MM-DD` and a day that exists — `2026-02-30` matches the pattern and is
 * not a date. Read in UTC deliberately: these are wall-clock dates with no zone
 * of their own (#56), and parsing them in the server's zone would shift them.
 */
function isRealDate(date: string): boolean {
  if (!DATE_PATTERN.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}
