/**
 * Calendar: the materialiser, the range query, and the two quick actions that
 * the calendar page reaches for (#5).
 *
 * Four rules shape this module:
 *
 * - **Materialisation is idempotent (#7/#49/#73).** The materialiser runs after
 *   a schedule change, a ghost tap, a manual re-run, or a retry after Neon's
 *   autosuspend `fetch failed` — and every path writes with a `NOT EXISTS` guard
 *   so a second run writes nothing new. A retry costs nothing.
 *
 * - **History is never rewritten (#24).** Held and cancelled meetings are
 *   untouched by materialisation and by schedule changes. A schedule change
 *   moves future PROPOSED meetings to the new weekday; held nights stay where
 *   they happened.
 *
 * - **8 weeks of proposed, drawn from the group's schedule (#49/#59).** Ghosts
 *   *beyond* 8 weeks are not rows — they are computed by the page from the
 *   group's schedule when the leader scrolls past the materialised edge.
 *
 * - **Past-due resolution is one tap (#52).** A proposed meeting whose date has
 *   passed can be marked held or cancelled in a single action. A meeting in the
 *   future is not past-due and cannot be resolved this way — that would let a
 *   mis-tap assert a night happened.
 */
import { addDays, weekdayOf, manilaToday } from "../dates";
import type { TransactionClient } from "../db";
import { query, transaction } from "../db";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 8 weeks forward from the materialiser's start date (#49/#59). */
export const MATERIALISE_WEEKS = 8;

export type CalendarEntry = {
  id: string;
  groupId: string;
  groupName: string;
  /** 0 = Sunday (#46), computed from the meeting's date not the group's current weekday. */
  weekday: number;
  /** `HH:MM:SS` — Postgres's wall-clock time back. */
  startTime: string;
  durationMinutes: number;
  date: string;
  bookId: string | null;
  bookNumber: number | null;
  bookTitle: string | null;
  sessionId: string | null;
  sessionNumber: number | null;
  sessionTitle: string | null;
  notes: string | null;
  status: "proposed" | "held" | "cancelled";
  origin: "generated" | "created";
  ledBy: string;
};

/** The range the calendar page asks for. Both ends are `YYYY-MM-DD` strings. */
export type CalendarRange = { from: string; to: string };

const SELECT_CALENDAR = `
  SELECT m.id,
         m.group_id,
         g.name AS group_name,
         -- Weekday is computed from the meeting's own date, not g.weekday.
         -- After a schedule change (#48b), g.weekday becomes the new day, but a
         -- held or cancelled meeting that happened under the old schedule must
         -- still show the weekday it actually occurred on.
         EXTRACT(DOW FROM m.date)::integer AS weekday,
         m.start_time,
         m.duration_minutes,
         to_char(m.date, 'YYYY-MM-DD') AS date,
         m.book_id,
         b.number AS book_number,
         b.title AS book_title,
         m.session_id,
         s.number AS session_number,
         s.title AS session_title,
         m.notes,
         m.status,
         m.origin,
         m.led_by
    FROM meetings m
    JOIN groups g ON g.id = m.group_id
    LEFT JOIN books b ON b.id = m.book_id
    LEFT JOIN sessions s ON s.id = m.session_id
`;

/**
 * Every meeting in the open range, owned by this leader, in date order.
 *
 * This is the calendar page's read. It does NOT filter by status — proposed,
 * held, and cancelled all appear, because the page must show all three
 * differently: proposed (with past-due flagging), held, and cancelled
 * (greyed + struck through, #50).
 */
export async function getCalendar(
  ownerId: string,
  range: CalendarRange,
): Promise<CalendarEntry[]> {
  const rows = await query<CalendarRow>(
    `${SELECT_CALENDAR}
       WHERE m.owner_id = $1
         AND m.date >= $2::date
         AND m.date <= $3::date
       ORDER BY m.date ASC, m.start_time ASC`,
    [ownerId, range.from, range.to],
  );
  return rows.map(toEntry);
}

/**
 * Materialise 8 weeks of proposed meetings from each live group's schedule.
 *
 * Called from issue 4's server action after a recurring meeting is created or
 * the schedule is changed, and on an explicit re-run. Every existing status —
 * held, cancelled, human-created proposed — is left untouched; new proposed
 * rows are written only where none exists for that (group, date).
 */
export async function materializeSchedule(ownerId: string, fromDate: string): Promise<void> {
  await transaction(async (tx) => {
    await materializeScheduleInTx(tx, ownerId, fromDate);
  });
}

/**
 * The transactional body of `materializeSchedule`, exported for `meetings.ts`
 * to call inside its own transaction when a recurring meeting is created (#48).
 * The caller has already set the group's schedule; this just fills the 8-week
 * horizon on the new day.
 */
export async function materializeScheduleInTx(
  tx: TransactionClient,
  ownerId: string,
  fromDate: string,
): Promise<void> {
  const groups = await tx.query<{
    id: string;
    weekday: number;
    start_time: string;
    duration_minutes: number;
    current_book_id: string | null;
  }>(
    `SELECT id, weekday, start_time, duration_minutes, current_book_id
       FROM groups
      WHERE owner_id = $1 AND archived_at IS NULL`,
    [ownerId],
  );

  for (const group of groups) {
    // The next occurrence of this group's weekday starting from fromDate.
    const startDate = firstOccurrence(fromDate, group.weekday);

    for (let i = 0; i < MATERIALISE_WEEKS; i++) {
      const date = addDays(startDate, i * 7);

      // A meeting on this (group, date) already exists — whether held by a
      // past attendance sheet, cancelled, human-created, or a generated one
      // from a prior run — the calendar must not have two rows on the same
      // day. The `NOT EXISTS` guard is the check-then-insert that the partial
      // unique index (#73) cannot cover on its own: that index only dedupes
      // generated-vs-generated, not generated-vs-held.
      await tx.query(
        `INSERT INTO meetings
           (owner_id, led_by, group_id, date, start_time, duration_minutes,
            book_id, session_id, notes, status, origin)
         SELECT $1, $1, $2, $3::date, $4, $5, g.current_book_id,
                -- The prefill session is the book's first; the attendance
                -- sheet is where a real session gets attached (#53).
                (SELECT id FROM sessions WHERE book_id = g.current_book_id ORDER BY number ASC LIMIT 1),
                NULL, 'proposed', 'generated'
          FROM groups g WHERE g.id = $2
           AND NOT EXISTS (SELECT 1 FROM meetings m
                            WHERE m.owner_id = $1 AND m.group_id = $2 AND m.date = $3::date)`,
        [ownerId, group.id, date, group.start_time, group.duration_minutes],
      );
    }
  }
}

/**
 * Past-due resolution, one tap (#52).
 *
 * A proposed meeting whose date has passed is either held (it happened) or
 * cancelled (it did not). A meeting already held or cancelled is a no-op —
 * the deliberate act already happened. A meeting still in the future is
 * rejected: asserting "it happened" before the night arrives is the mistake
 * this guard exists to stop.
 */
export async function resolveMeeting(
  ownerId: string,
  groupId: string,
  date: string,
  status: "held" | "cancelled",
): Promise<void> {
  await transaction(async (tx) => {
    const rows = await tx.query<{ id: string; status: string }>(
      `SELECT id, status
         FROM meetings
        WHERE owner_id = $1 AND group_id = $2 AND date = $3::date
        ORDER BY created_at ASC
        LIMIT 1`,
      [ownerId, groupId, date],
    );

    if (rows.length === 0) {
      throw new CalendarError("That meeting is no longer on your calendar.");
    }

    const meeting = rows[0];
    // #52: already resolved — held or cancelled — is a no-op, not an error.
    // The deliberate act already happened; the page's tap should not scold.
    if (meeting.status !== "proposed") {
      return;
    }

    // #52: a past-due proposed meeting. The date must have passed — resolving
    // a future night would let a mis-tap assert a meeting happened.
    // `today` is read in Manila (#56).
    const today = manilaToday();
    if (date >= today) {
      throw new CalendarError("That meeting has not passed yet.");
    }

    await tx.query(
      `UPDATE meetings SET status = $3, updated_at = now()
         WHERE owner_id = $1 AND id = $2 AND status = 'proposed'`,
      [ownerId, meeting.id, status],
    );
  });
}

/**
 * Cancel a meeting so it shows greyed and struck through on the calendar (#50).
 *
 * Unlike `resolveMeeting`, this is reachable for any proposed meeting — not just
 * past-due ones — because cancelling a meeting you are not going to hold is a
 * forward action. A held meeting cannot be cancelled: that would erase the
 * record of a night that happened (#24).
 */
export async function cancelMeeting(
  ownerId: string,
  groupId: string,
  date: string,
): Promise<void> {
  await transaction(async (tx) => {
    const rows = await tx.query<{ id: string; status: string }>(
      `SELECT id, status
         FROM meetings
        WHERE owner_id = $1 AND group_id = $2 AND date = $3::date
        ORDER BY created_at ASC
        LIMIT 1`,
      [ownerId, groupId, date],
    );

    if (rows.length === 0) {
      throw new CalendarError("That meeting is no longer on your calendar.");
    }

    if (rows[0].status === "held") {
      throw new CalendarError("That meeting was held — it cannot be cancelled.");
    }

    await tx.query(
      `UPDATE meetings SET status = 'cancelled', updated_at = now()
         WHERE owner_id = $1 AND id = $2 AND status IN ('proposed')`,
      [ownerId, rows[0].id],
    );
  });
}

/**
 * A schedule change moves every future PROPOSED meeting to the new weekday,
 * leaving held and cancelled meetings where they are (#48b/#24).
 *
 * Called right after `setGroupSchedule` writes the new day/time/duration.
 * Materialisation then re-fills the 8-week window on the new schedule — the two
 * steps together keep the calendar's forward horizon full while preserving a
 * held night's original date forever.
 */
export async function shiftProposedMeetings(
  ownerId: string,
  groupId: string,
  newWeekday: number,
  startTime: string,
  durationMinutes: number,
): Promise<void> {
  if (!UUID_PATTERN.test(groupId)) {
    throw new CalendarError("That BGroup does not exist.");
  }

  await transaction(async (tx) => {
    await shiftProposedMeetingsInTx(tx, ownerId, groupId, newWeekday, startTime, durationMinutes);
  });
}

/**
 * The transactional body of `shiftProposedMeetings`, exported for `meetings.ts`
 * to call inside its own transaction when a recurring meeting is created (#48).
 */
export async function shiftProposedMeetingsInTx(
  tx: TransactionClient,
  ownerId: string,
  groupId: string,
  newWeekday: number,
  startTime: string,
  durationMinutes: number,
): Promise<void> {
  // Pull the proposed generated meetings, shift them to the new weekday.
  // #24: held and cancelled are never in this result set — the WHERE clause
  // restricts to status = 'proposed' AND origin = 'generated'.
  const rows = await tx.query<{ id: string; date: string }>(
    `SELECT id, to_char(date, 'YYYY-MM-DD') AS date
       FROM meetings
      WHERE owner_id = $1 AND group_id = $2 AND status = 'proposed' AND origin = 'generated'`,
    [ownerId, groupId],
  );

  for (const row of rows) {
    const shifted = shiftDateToWeekday(row.date, newWeekday);
    await tx.query(
      `UPDATE meetings
          SET date = $3::date,
              start_time = $4::time,
              duration_minutes = $5,
              updated_at = now()
        WHERE owner_id = $1 AND id = $2 AND status = 'proposed' AND origin = 'generated'`,
      [ownerId, row.id, shifted, startTime, durationMinutes],
    );
  }
}

/**
 * The first date on or after `from` that falls on `weekday`.
 * `weekday` is 0 = Sunday, matching #46 and JS's `getDay()`.
 */
function firstOccurrence(from: string, weekday: number): string {
  let candidate = from;
  while (weekdayOf(candidate) !== weekday) {
    candidate = addDays(candidate, 1);
  }
  return candidate;
}

/**
 * Move `date` to the next `weekday` on or after it — but NOT before it.
 * A meeting scheduled for a past Sunday that moves to Tuesday lands on the
 * Tuesday *after* that Sunday, not the Tuesday that already passed.
 */
function shiftDateToWeekday(date: string, weekday: number): string {
  const current = weekdayOf(date);
  if (current === weekday) return date;
  const diff = (weekday - current + 7) % 7;
  return addDays(date, diff);
}

type CalendarRow = {
  id: string;
  group_id: string;
  group_name: string;
  weekday: number;
  start_time: string;
  duration_minutes: number;
  date: string;
  book_id: string | null;
  book_number: number | null;
  book_title: string | null;
  session_id: string | null;
  session_number: number | null;
  session_title: string | null;
  notes: string | null;
  status: string;
  origin: string;
  led_by: string;
};

function toEntry(row: CalendarRow): CalendarEntry {
  return {
    id: row.id,
    groupId: row.group_id,
    groupName: row.group_name,
    weekday: row.weekday,
    startTime: row.start_time,
    durationMinutes: row.duration_minutes,
    date: row.date,
    bookId: row.book_id,
    bookNumber: row.book_number,
    bookTitle: row.book_title,
    sessionId: row.session_id,
    sessionNumber: row.session_number,
    sessionTitle: row.session_title,
    notes: row.notes,
    status: row.status as CalendarEntry["status"],
    origin: row.origin as CalendarEntry["origin"],
    ledBy: row.led_by,
  };
}

export class CalendarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalendarError";
  }
}
