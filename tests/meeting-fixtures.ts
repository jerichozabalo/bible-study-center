/**
 * Scaffolding for the meetings tests, on top of `tests/fixtures.ts`.
 *
 * It lives in its own file rather than in `fixtures.ts` because the roster
 * fixtures are shared with the issues either side of this one; nothing here is
 * needed by a test that has no meetings in it.
 *
 * The two inserts below write straight to the table on purpose. A *generated*
 * meeting is the #7 materialiser's output and that is issue 5, and marking a
 * meeting HELD is issue 6 — this issue's module can create neither, and a test
 * for #73's index or for #53's prefill needs both to exist.
 */
import { query } from "@/lib/db";

/**
 * Empty the meetings table. Run before `resetRoster()`, which is what deletes
 * the groups these rows point at.
 *
 * Completions and their corrections (migration 006) cascade from `meetings`, so
 * this is also what clears an attendance sheet between tests.
 */
export async function resetMeetings(): Promise<void> {
  await query("DELETE FROM meetings");
}

/**
 * A meeting the app proposed rather than one Jericho created (#73) — what the
 * issue-5 materialiser will write, and the row the partial unique index is
 * about.
 */
export async function addGeneratedMeeting(
  ownerId: string,
  groupId: string,
  date: string,
  startTime = "19:00",
  durationMinutes = 90,
): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO meetings
       (owner_id, led_by, group_id, date, start_time, duration_minutes, status, origin)
     VALUES ($1, $1, $2, $3, $4, $5, 'proposed', 'generated')
     RETURNING id`,
    [ownerId, groupId, date, startTime, durationMinutes],
  );
  return rows[0].id;
}

/**
 * A meeting that already happened: HELD, on a book and session. Issue 6 owns
 * the deliberate act (#47); this is the state it will leave behind, which is
 * what #53's prefill and #63's ordering both read.
 */
export async function addHeldMeeting(
  ownerId: string,
  groupId: string,
  date: string,
  covered: { bookId: string | null; sessionId: string | null } = { bookId: null, sessionId: null },
): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO meetings
       (owner_id, led_by, group_id, date, start_time, duration_minutes, book_id, session_id,
        status, origin)
     VALUES ($1, $1, $2, $3, '19:00', 90, $4, $5, 'held', 'created')
     RETURNING id`,
    [ownerId, groupId, date, covered.bookId, covered.sessionId],
  );
  return rows[0].id;
}

/**
 * A meeting that was called off (#50). Issue 5 owns cancelling; this is the row
 * it will write, and the attendance sheet has to refuse it long before then —
 * confirming a sheet is what marks a meeting HELD (#47), and a night nobody
 * held must not become one by way of a stale screen.
 */
export async function addCancelledMeeting(
  ownerId: string,
  groupId: string,
  date: string,
): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO meetings
       (owner_id, led_by, group_id, date, start_time, duration_minutes, status, origin)
     VALUES ($1, $1, $2, $3, '19:00', 90, 'cancelled', 'created')
     RETURNING id`,
    [ownerId, groupId, date],
  );
  return rows[0].id;
}

/** The id of a seeded session by its book and published number. */
export async function sessionIdByNumber(bookId: string, number: number): Promise<string> {
  const rows = await query<{ id: string }>(
    "SELECT id FROM sessions WHERE book_id = $1 AND number = $2",
    [bookId, number],
  );
  return rows[0].id;
}
