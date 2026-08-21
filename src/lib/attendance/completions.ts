/**
 * The tick model (#25/#65) — everything the attendance sheet writes.
 *
 * Four rules live here, because every screen that records attendance has to
 * come through this module:
 *
 * 1. **One tick means two things (#25).** 'attended' is present *and* covered
 *    the session the meeting was on; 'present-only' is present and covered
 *    nothing. Both are contact, which is what #64's quiet list counts.
 * 2. **One row per (person, meeting), with a nullable session (#65).** The
 *    session written beside an 'attended' mark is the meeting's own, so a
 *    fellowship night (#26) writes NULL for everybody and credits nothing —
 *    while still recording that they were there. 'present-only' always writes
 *    NULL. Nothing that counts book progress has to know what a mark is.
 * 3. **Confirming the sheet is what marks a meeting HELD (#47).** Creating one
 *    always yields proposed; *held* means it happened and attendance was taken,
 *    and that stays a deliberate act — `hold` on the save.
 * 4. **Nothing is erased (#24).** Editing or taking back a tick tombstones the
 *    row it replaced, so reopening a held sheet to fix a mistake is legal and
 *    leaves a record of the fix.
 *
 * Guests are not an entity (#31): a completion whose meeting's group is not the
 * person's home group *is* the visit, and "guest" is derived when it is drawn.
 * Issue 7 owns that derivation and the catch-up matching beside it.
 */
import { type TransactionClient, query, transaction } from "../db";
import { createPerson } from "../roster/people";

/** Something the sheet posted cannot be recorded, and the message says why. */
export class AttendanceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttendanceValidationError";
  }
}

/** #25. There is no 'absent': no row is what missing a night looks like. */
export type Mark = "attended" | "present-only";

/** One row of the posted sheet. `null` is an unticked person. */
export type SheetMark = { personId: string; mark: Mark | null };

export type RecordSheetInput = {
  meetingId: string;
  /** Every row the sheet showed, ticked or not — this is a full save. */
  marks: SheetMark[];
  /** #47 — the deliberate act. False while the sheet is still being taken. */
  hold: boolean;
};

export type Completion = {
  id: string;
  personId: string;
  personName: string;
  meetingId: string;
  /** NULL = covered nothing: a fellowship night (#26) or present only (#25). */
  sessionId: string | null;
  mark: Mark;
  createdAt: Date;
};

/** A session a person actually covered — the only thing that credits a book. */
export type CoveredSession = {
  sessionId: string;
  sessionNumber: number;
  sessionTitle: string;
  bookId: string;
  bookNumber: number | null;
  bookTitle: string;
  meetingId: string;
  /** `YYYY-MM-DD` of the night it was covered (#56). */
  date: string;
};

/** What a correction replaced (#24). `previous` is the whole row as it stood. */
export type CompletionCorrection = {
  id: string;
  personId: string;
  reason: string;
  previous: Record<string, unknown>;
  correctedAt: Date;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MARKS: readonly Mark[] = ["attended", "present-only"];

/** The meeting an attendance sheet is being taken for. */
type SheetMeeting = { id: string; groupId: string; sessionId: string | null; status: string };

/**
 * Save the sheet, and mark the meeting held if this is the confirmation (#47).
 *
 * The whole sheet is expected, not a delta: a person left out is simply not
 * touched, and a person posted with a null mark is unticked. That is what makes
 * one save from a room with no signal (#72's outbox, issue 11) replayable —
 * there is no order-dependent diff to get wrong.
 */
export async function recordSheet(ownerId: string, input: RecordSheetInput): Promise<void> {
  const marks = validateMarks(input.marks);

  await transaction(async (tx) => {
    const meeting = await loadMeeting(tx, ownerId, input.meetingId);
    await assertOnRoster(tx, ownerId, marks);

    const personIds = marks.map((mark) => mark.personId);
    const values = marks.map((mark) => mark.mark);
    // #65: an 'attended' tick carries the meeting's own session, which is NULL
    // on a fellowship night; 'present-only' carries NULL always.
    const sessions = marks.map((mark) => (mark.mark === "attended" ? meeting.sessionId : null));

    // #24 — keep what is about to be replaced, before it is. A row that is not
    // changing is left alone, so re-saving an unchanged sheet writes nothing.
    await tx.query(
      `INSERT INTO completion_corrections (owner_id, person_id, meeting_id, reason, previous)
       SELECT c.owner_id,
              c.person_id,
              c.meeting_id,
              CASE WHEN w.mark IS NULL THEN 'cleared' ELSE 'edit' END,
              to_jsonb(c)
         FROM completions c
         JOIN unnest($3::uuid[], $4::text[], $5::uuid[]) AS w(person_id, mark, session_id)
           ON w.person_id = c.person_id
        WHERE c.owner_id = $1
          AND c.meeting_id = $2
          AND (w.mark IS NULL
               OR w.mark IS DISTINCT FROM c.mark
               OR w.session_id IS DISTINCT FROM c.session_id)`,
      [ownerId, meeting.id, personIds, values, sessions],
    );

    // Unticking removes the row: a completion means "this happened", and the
    // tombstone above is where the tick that was taken back now lives.
    await tx.query(
      `DELETE FROM completions c
        USING unnest($3::uuid[], $4::text[]) AS w(person_id, mark)
        WHERE c.owner_id = $1
          AND c.meeting_id = $2
          AND c.person_id = w.person_id
          AND w.mark IS NULL`,
      [ownerId, meeting.id, personIds, values],
    );

    await tx.query(
      `INSERT INTO completions (owner_id, person_id, meeting_id, session_id, mark)
       SELECT $1, w.person_id, $2, w.session_id, w.mark
         FROM unnest($3::uuid[], $4::text[], $5::uuid[]) AS w(person_id, mark, session_id)
        WHERE w.mark IS NOT NULL
       ON CONFLICT (person_id, meeting_id) DO UPDATE
          SET session_id = EXCLUDED.session_id, mark = EXCLUDED.mark, updated_at = now()
        WHERE completions.mark IS DISTINCT FROM EXCLUDED.mark
           OR completions.session_id IS DISTINCT FROM EXCLUDED.session_id`,
      [ownerId, meeting.id, personIds, values, sessions],
    );

    if (input.hold) {
      // #47. Already held stays held: reopening a sheet to fix a tick is an
      // edit to history, not a second event.
      await tx.query(
        `UPDATE meetings SET status = 'held', updated_at = now()
          WHERE owner_id = $1 AND id = $2 AND status <> 'cancelled'`,
        [ownerId, meeting.id],
      );
    }
  });
}

/**
 * #25/#67 — the walk-in, captured from the sheet on a name alone.
 *
 * Their home group defaults to the meeting's: someone who walks into a BGroup's
 * night is that BGroup's until the leader says otherwise. `createPerson` is the
 * one path onto the roster, so the #9 deferral and its incomplete flag are the
 * roster's rules and not a second set of them here.
 *
 * The tick is a second write rather than part of the same transaction, because
 * `createPerson` runs its own. If it were to fail, the person is on the roster
 * and unticked — recoverable in one tap, which the other order is not.
 */
export async function addWalkIn(
  ownerId: string,
  meetingId: string,
  name: string,
): Promise<string> {
  const meeting = await loadMeeting({ query }, ownerId, meetingId);

  const personId = await createPerson(ownerId, { name, homeGroupId: meeting.groupId });

  // Adding someone from the sheet means they are in the room — that is the only
  // reason to reach for it mid-meeting (#25/#30).
  await recordSheet(ownerId, {
    meetingId: meeting.id,
    marks: [{ personId, mark: "attended" }],
    hold: false,
  });

  return personId;
}

/** Every mark recorded for one meeting, in the sheet's own order. */
export async function listCompletions(ownerId: string, meetingId: string): Promise<Completion[]> {
  if (!UUID_PATTERN.test(meetingId)) return [];

  const rows = await query<{
    id: string;
    person_id: string;
    person_name: string;
    meeting_id: string;
    session_id: string | null;
    mark: Mark;
    created_at: Date;
  }>(
    `SELECT c.id,
            c.person_id,
            p.name AS person_name,
            c.meeting_id,
            c.session_id,
            c.mark,
            c.created_at
       FROM completions c
       JOIN people p ON p.id = c.person_id
      WHERE c.owner_id = $1 AND c.meeting_id = $2
      ORDER BY lower(p.name) ASC`,
    [ownerId, meetingId],
  );

  return rows.map((row) => ({
    id: row.id,
    personId: row.person_id,
    personName: row.person_name,
    meetingId: row.meeting_id,
    sessionId: row.session_id,
    mark: row.mark,
    createdAt: row.created_at,
  }));
}

/**
 * What one person has actually covered — the seam issue 9 draws progress from,
 * and the reason #65's NULL is not a detail: a row with no session is not here.
 *
 * Two filters carry decisions rather than taste. A **retired** session (005) is
 * no longer part of its book, so it can no longer count toward it — the row
 * still resolves, it simply credits nothing. A **cancelled** meeting never
 * happened (#50), so neither did what it was going to cover.
 */
export async function listCoveredSessions(
  ownerId: string,
  personId: string,
): Promise<CoveredSession[]> {
  if (!UUID_PATTERN.test(personId)) return [];

  const rows = await query<{
    session_id: string;
    session_number: number;
    session_title: string;
    book_id: string;
    book_number: number | null;
    book_title: string;
    meeting_id: string;
    date: string;
  }>(
    `SELECT c.session_id,
            s.number AS session_number,
            s.title AS session_title,
            b.id AS book_id,
            b.number AS book_number,
            b.title AS book_title,
            m.id AS meeting_id,
            to_char(m.date, 'YYYY-MM-DD') AS date
       FROM completions c
       JOIN sessions s ON s.id = c.session_id
       JOIN books b ON b.id = s.book_id
       JOIN meetings m ON m.id = c.meeting_id
      WHERE c.owner_id = $1
        AND c.person_id = $2
        AND c.session_id IS NOT NULL
        AND s.retired_at IS NULL
        AND m.status <> 'cancelled'
      ORDER BY b.number ASC NULLS LAST, b.created_at ASC, s.number ASC`,
    [ownerId, personId],
  );

  return rows.map((row) => ({
    sessionId: row.session_id,
    sessionNumber: row.session_number,
    sessionTitle: row.session_title,
    bookId: row.book_id,
    bookNumber: row.book_number,
    bookTitle: row.book_title,
    meetingId: row.meeting_id,
    date: row.date,
  }));
}

/**
 * What this meeting's sheet used to say (#24), oldest first.
 *
 * Nothing renders it yet — the sheet shows the marks as they stand. It is the
 * readable end of the tombstone, and the reason a correction can be proved to
 * keep what it replaced.
 */
export async function listCompletionCorrections(
  ownerId: string,
  meetingId: string,
): Promise<CompletionCorrection[]> {
  if (!UUID_PATTERN.test(meetingId)) return [];

  const rows = await query<{
    id: string;
    person_id: string;
    reason: string;
    previous: Record<string, unknown>;
    corrected_at: Date;
  }>(
    `SELECT id, person_id, reason, previous, corrected_at
       FROM completion_corrections
      WHERE owner_id = $1 AND meeting_id = $2
      ORDER BY corrected_at ASC, id ASC`,
    [ownerId, meetingId],
  );

  return rows.map((row) => ({
    id: row.id,
    personId: row.person_id,
    reason: row.reason,
    previous: row.previous,
    correctedAt: row.corrected_at,
  }));
}

/**
 * The meeting this sheet belongs to, refusing what a sheet must never record.
 *
 * A cancelled night is the one that matters: it did not happen (#50), and a
 * stale screen saving against it would mark it held — the opposite of what
 * cancelling it said.
 */
async function loadMeeting(
  tx: Pick<TransactionClient, "query">,
  ownerId: string,
  meetingId: string,
): Promise<SheetMeeting> {
  if (!UUID_PATTERN.test(meetingId)) {
    throw new AttendanceValidationError("That meeting is no longer on your calendar.");
  }

  const rows = await tx.query<{
    id: string;
    group_id: string;
    session_id: string | null;
    status: string;
  }>("SELECT id, group_id, session_id, status FROM meetings WHERE owner_id = $1 AND id = $2", [
    ownerId,
    meetingId,
  ]);

  const meeting = rows[0];
  if (!meeting) {
    throw new AttendanceValidationError("That meeting is no longer on your calendar.");
  }
  if (meeting.status === "cancelled") {
    throw new AttendanceValidationError(
      "That meeting was cancelled. Create the night again to take attendance.",
    );
  }

  return {
    id: meeting.id,
    groupId: meeting.group_id,
    sessionId: meeting.session_id,
    status: meeting.status,
  };
}

/**
 * Everyone posted has to be on this leader's roster — removed people included
 * (#24): a night they attended before they left the roster is still a night
 * that can be corrected.
 */
async function assertOnRoster(
  tx: Pick<TransactionClient, "query">,
  ownerId: string,
  marks: SheetMark[],
): Promise<void> {
  if (marks.length === 0) return;

  const rows = await tx.query<{ id: string }>(
    "SELECT id FROM people WHERE owner_id = $1 AND id = ANY($2::uuid[])",
    [ownerId, marks.map((mark) => mark.personId)],
  );

  if (rows.length !== marks.length) {
    throw new AttendanceValidationError("Someone on this sheet is not on your roster.");
  }
}

/**
 * The posted sheet, cleaned: real ids, known marks, one entry per person. The
 * last word wins on a duplicate, which is what a form that posted the same
 * person twice means — and what the upsert below could not survive.
 */
function validateMarks(marks: SheetMark[]): SheetMark[] {
  const byPerson = new Map<string, SheetMark>();

  for (const mark of marks) {
    if (!UUID_PATTERN.test(mark.personId)) {
      throw new AttendanceValidationError("Someone on this sheet is not on your roster.");
    }
    if (mark.mark !== null && !MARKS.includes(mark.mark)) {
      throw new AttendanceValidationError("That is not a way to mark someone.");
    }
    byPerson.set(mark.personId, { personId: mark.personId, mark: mark.mark });
  }

  return [...byPerson.values()];
}
