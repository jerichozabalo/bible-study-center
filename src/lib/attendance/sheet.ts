/**
 * The sheet a meeting opens on — the read half of attendance.
 *
 * Who is on it is two lists unioned, and the second one is the point: the
 * BGroup's roster as it stands, plus **anyone this meeting already records**.
 * A person who has since transferred (#27), or been removed from the roster
 * (#24), or who rode along from another BGroup (#31) is still part of what
 * happened that night, and a sheet that dropped them would quietly rewrite it.
 *
 * What this module deliberately does NOT say:
 *
 * - **Who is a guest.** A completion whose meeting's group is not the person's
 *   home group is the visit (#31, no guest entity) — `homeGroupId` and the
 *   meeting's group are both here, and issue 7 derives the marker from them.
 * - **How far anyone has got.** The board's second line ("3 of 6 done in One By
 *   One") is issue 9's, and a number invented here would be an invented one.
 */
import { type MeetingSummary, getMeeting } from "../meetings/meetings";
import { query } from "../db";
import type { Mark } from "./completions";

export type SheetPerson = {
  personId: string;
  name: string;
  /** Their own BGroup, which is not always the meeting's (#31). */
  homeGroupId: string | null;
  homeGroupName: string | null;
  /** #9/#67 — saved on a name alone and still owed a way to reach them. */
  contactIncomplete: boolean;
  /** #24 — off the roster, still on the night they attended. */
  removedAt: Date | null;
  /** NULL = not ticked. */
  mark: Mark | null;
};

export type Sheet = {
  meeting: MeetingSummary;
  /** Alphabetical, ignoring case — the roster's own order. */
  people: SheetPerson[];
};

export async function getSheet(ownerId: string, meetingId: string): Promise<Sheet | null> {
  const meeting = await getMeeting(ownerId, meetingId);
  if (!meeting) return null;

  const rows = await query<{
    person_id: string;
    name: string;
    home_group_id: string | null;
    home_group_name: string | null;
    phone: string | null;
    email: string | null;
    removed_at: Date | null;
    mark: Mark | null;
  }>(
    `SELECT p.id AS person_id,
            p.name,
            p.home_group_id,
            g.name AS home_group_name,
            p.phone,
            p.email,
            p.removed_at,
            c.mark
       FROM people p
       LEFT JOIN groups g ON g.id = p.home_group_id
       LEFT JOIN completions c ON c.person_id = p.id AND c.meeting_id = $2
      WHERE p.owner_id = $1
        AND ((p.home_group_id = $3 AND p.removed_at IS NULL) OR c.id IS NOT NULL)
      ORDER BY lower(p.name) ASC`,
    [ownerId, meeting.id, meeting.groupId],
  );

  return {
    meeting,
    people: rows.map((row) => ({
      personId: row.person_id,
      name: row.name,
      homeGroupId: row.home_group_id,
      homeGroupName: row.home_group_name,
      // Derived here exactly as the roster derives it, so the flag clears
      // itself the moment a number lands (#67).
      contactIncomplete: row.phone === null && row.email === null,
      removedAt: row.removed_at,
      mark: row.mark,
    })),
  };
}
