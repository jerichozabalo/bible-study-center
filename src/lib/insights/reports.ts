/**
 * The three Reports (#21) — person sheet, group history, ministry roll-up — and
 * the CSV each exports. For Jericho's eyes only: there is no share path, no
 * external recipient, no "reporting engine" (rejected in #21).
 *
 * The read-only half of the app (PRD module 6). Nothing here writes and nothing
 * is stored — a report is what the roster, the meetings and the completions
 * mean, recomputed each time it is asked for. Progress and the quiet count are
 * *composed* from issue 8/9's derivations rather than re-queried:
 * `getPersonProgress`, `getGroupBookProgress` and `getQuietMembers` already
 * settle strict completion (#5), #28's joined-at markers and #64's streak, and a
 * second implementation of any of them would be a second answer.
 *
 * Three rules the decision log is explicit about:
 *
 * 1. **#31 — a guest visit credits the person, not the group.** Someone whose
 *    home BGroup is not the meeting's BGroup shows in that group's history as a
 *    visitor; their completion counts toward their own book progress and the
 *    roll-up; no home-group or roll-up head-count moves because of the visit.
 * 2. **Tombstones are history, not reporting data (#24).** A removed person is
 *    off every export — `getPersonReport` returns null for one. A cancelled
 *    meeting (#50) is a real fact about a group's calendar, so it stays in the
 *    group history (with no attendee list); a proposed night has not happened
 *    (#47) and is left out.
 * 3. **"Export" is the only word for CSV out (#66).** Never "back up", never
 *    "Sync". The serialisers here produce the exact bytes the download carries;
 *    `csv.ts` does the quoting and `reports.test.ts` pins each one with a
 *    golden file so the columns cannot drift.
 */
import { bookLabel } from "../curriculum/books";
import { query } from "../db";
import { formatSchedule } from "../roster/schedule";
import { toCsv } from "./csv";
import { type BookProgress, type GroupBookProgress, getGroupBookProgress, getPersonProgress } from "./progress";
import { getQuietMembers } from "./quiet";
import { getPerson } from "../roster/people";
import { getGroup } from "../roster/groups";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ------------------------------------------------------------------ person -- */

/** One night on the person's attendance history — a completion, read as a row. */
export type PersonReportAttendance = {
  /** `YYYY-MM-DD` (#56). */
  date: string;
  /** The BGroup that met — not always their home one. */
  groupName: string;
  /** #31 — the meeting's BGroup was not this person's home BGroup. */
  guest: boolean;
  /** "Session 3 — One Proof", "Fellowship night" (#26), or "Present only" (#25). */
  coverage: string;
  mark: "attended" | "present-only";
};

export type PersonReport = {
  person: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    homeGroupName: string | null;
    spiritualStatus: string | null;
    baptized: boolean;
    baptizedOn: string | null;
    joinedOn: string;
    birthday: string | null;
    address: string | null;
    civilStatus: string | null;
    invitedBy: string | null;
    steppedAwayOn: string | null;
  };
  /** Every published book, covered or not — `getPersonProgress`'s own list. */
  progress: BookProgress[];
  /** Most recent night first; cancelled meetings are left out (#50). */
  attendance: PersonReportAttendance[];
};

/**
 * The person sheet: contact, spiritual status, baptized state (#66 spelling),
 * per-book progress, and the attendance history.
 *
 * NULL for someone who is not on the roster or has been removed (#24) — a
 * tombstone is kept for history, not published in a report.
 */
export async function getPersonReport(
  ownerId: string,
  personId: string,
): Promise<PersonReport | null> {
  if (!UUID_PATTERN.test(personId)) return null;

  const person = await getPerson(ownerId, personId);
  if (!person || person.removedAt !== null) return null;

  const progress = await getPersonProgress(ownerId, personId);

  const rows = await query<{
    date: string;
    group_name: string;
    group_id: string;
    session_number: number | null;
    session_title: string | null;
    meeting_has_session: boolean;
    mark: "attended" | "present-only";
  }>(
    `SELECT to_char(m.date, 'YYYY-MM-DD') AS date,
            g.name AS group_name,
            m.group_id,
            cs.number AS session_number,
            cs.title AS session_title,
            (m.session_id IS NOT NULL) AS meeting_has_session,
            c.mark
       FROM completions c
       JOIN meetings m ON m.id = c.meeting_id
       JOIN groups g ON g.id = m.group_id
       LEFT JOIN sessions cs ON cs.id = c.session_id
      WHERE c.owner_id = $1
        AND c.person_id = $2
        AND m.status <> 'cancelled'
      ORDER BY m.date DESC, m.start_time DESC, m.id DESC`,
    [ownerId, personId],
  );

  const attendance = rows.map((row) => ({
    date: row.date,
    groupName: row.group_name,
    guest: person.homeGroupId !== null && row.group_id !== person.homeGroupId,
    // A row with a session covered it; without one, "Present only" (#25) if the
    // night had a session to skip, "Fellowship night" (#26) if it did not.
    coverage:
      row.session_number !== null
        ? `Session ${row.session_number} — ${row.session_title}`
        : row.meeting_has_session
          ? "Present only"
          : "Fellowship night",
    mark: row.mark,
  }));

  return {
    person: {
      id: person.id,
      name: person.name,
      phone: person.phone,
      email: person.email,
      homeGroupName: person.homeGroupName,
      spiritualStatus: person.spiritualStatus,
      baptized: person.baptized,
      baptizedOn: person.baptizedOn,
      joinedOn: person.joinedOn,
      birthday: person.birthday,
      address: person.address,
      civilStatus: person.civilStatus,
      invitedBy: person.invitedBy,
      steppedAwayOn: person.steppedAwayOn,
    },
    progress,
    attendance,
  };
}

/* ------------------------------------------------------------------- group -- */

/** One night on a group's history — held or cancelled, never a proposed one. */
export type GroupReportMeeting = {
  meetingId: string;
  date: string;
  status: "held" | "cancelled";
  /** "Session 2 — One Way", "Fellowship night" (#26), or "Cancelled" (#50). */
  coverage: string;
  notes: string | null;
  /** People still on the roster who have a completion for the night. */
  attendeeCount: number;
  /** #31 — attendees whose home BGroup is not this one, alphabetical. */
  guests: { name: string; homeGroupName: string | null }[];
};

export type GroupReport = {
  group: {
    id: string;
    name: string;
    schedule: string;
    currentBookLabel: string | null;
    archivedAt: Date | null;
  };
  heldCount: number;
  cancelledCount: number;
  /** Most recent night first. */
  meetings: GroupReportMeeting[];
  /** `getGroupBookProgress` — NULL when the group has no book yet (#17). */
  bookProgress: GroupBookProgress | null;
};

/**
 * The group history: its held and cancelled nights, the attendance and guest
 * visits (#31) on each, and the current-book roll-up across its members.
 *
 * NULL when the BGroup is not on this leader's list. An archived group (#27)
 * still reports — it is history, and the view says it is archived.
 */
export async function getGroupReport(
  ownerId: string,
  groupId: string,
): Promise<GroupReport | null> {
  if (!UUID_PATTERN.test(groupId)) return null;

  const group = await getGroup(ownerId, groupId);
  if (!group) return null;

  const meetingRows = await query<{
    id: string;
    date: string;
    status: "held" | "cancelled";
    session_number: number | null;
    session_title: string | null;
    notes: string | null;
    attendee_count: number;
  }>(
    `SELECT m.id,
            to_char(m.date, 'YYYY-MM-DD') AS date,
            m.status,
            s.number AS session_number,
            s.title AS session_title,
            m.notes,
            (SELECT count(*)::int
               FROM completions c
               JOIN people p ON p.id = c.person_id
              WHERE c.meeting_id = m.id AND p.removed_at IS NULL) AS attendee_count
       FROM meetings m
       LEFT JOIN sessions s ON s.id = m.session_id
      WHERE m.owner_id = $1
        AND m.group_id = $2
        AND m.status IN ('held', 'cancelled')
      ORDER BY m.date DESC, m.start_time DESC, m.id DESC`,
    [ownerId, groupId],
  );

  const guestRows = await query<{
    meeting_id: string;
    name: string;
    home_group_name: string | null;
  }>(
    `SELECT c.meeting_id,
            p.name,
            hg.name AS home_group_name
       FROM completions c
       JOIN meetings m ON m.id = c.meeting_id
       JOIN people p ON p.id = c.person_id
       LEFT JOIN groups hg ON hg.id = p.home_group_id
      WHERE c.owner_id = $1
        AND m.group_id = $2
        AND m.status IN ('held', 'cancelled')
        AND p.removed_at IS NULL
        AND p.home_group_id IS NOT NULL
        AND p.home_group_id <> $2
      ORDER BY lower(p.name) ASC`,
    [ownerId, groupId],
  );

  const guestsByMeeting = new Map<string, { name: string; homeGroupName: string | null }[]>();
  for (const row of guestRows) {
    const list = guestsByMeeting.get(row.meeting_id) ?? [];
    list.push({ name: row.name, homeGroupName: row.home_group_name });
    guestsByMeeting.set(row.meeting_id, list);
  }

  const meetings: GroupReportMeeting[] = meetingRows.map((row) => ({
    meetingId: row.id,
    date: row.date,
    status: row.status,
    coverage:
      row.status === "cancelled"
        ? "Cancelled"
        : row.session_number !== null
          ? `Session ${row.session_number} — ${row.session_title}`
          : "Fellowship night",
    notes: row.notes,
    attendeeCount: row.status === "cancelled" ? 0 : row.attendee_count,
    guests: guestsByMeeting.get(row.id) ?? [],
  }));

  return {
    group: {
      id: group.id,
      name: group.name,
      schedule: formatSchedule(group),
      currentBookLabel:
        group.currentBookTitle === null
          ? null
          : bookLabel({ number: group.currentBookNumber, title: group.currentBookTitle }),
      archivedAt: group.archivedAt,
    },
    heldCount: meetings.filter((m) => m.status === "held").length,
    cancelledCount: meetings.filter((m) => m.status === "cancelled").length,
    meetings,
    bookProgress: await getGroupBookProgress(ownerId, groupId),
  };
}

/* ------------------------------------------------------------------- roll-up */

export type RollupBook = {
  bookId: string;
  bookNumber: number | null;
  bookTitle: string;
  /** Members (still on the roster) who have every live session of the book (#5). */
  completedCount: number;
};

export type Rollup = {
  /** People on the roster — removed people are not counted (#24). */
  members: number;
  activeGroups: number;
  archivedGroups: number;
  /** `getQuietMembers().length` — #64's streak, stepped-away people excluded. */
  quiet: number;
  /** #10/#66 — the manual override, its own count and never folded into quiet. */
  steppedAway: number;
  /** #66 spelling. Members marked baptized. */
  baptized: number;
  /** The published curriculum, in its own order (#33). */
  books: RollupBook[];
};

/**
 * The ministry-wide roll-up: head counts, and how many members have finished
 * each published book.
 *
 * #31 in the counting: a guest completion has already credited the person in
 * `completions`, so a book they finished partly on a ride-along is counted here
 * exactly once — and no group head-count changes because someone visited it.
 */
export async function getRollup(ownerId: string): Promise<Rollup> {
  const [people] = await query<{
    members: number;
    stepped_away: number;
    baptized: number;
  }>(
    `SELECT count(*)::int AS members,
            count(*) FILTER (WHERE stepped_away_on IS NOT NULL)::int AS stepped_away,
            count(*) FILTER (WHERE baptized)::int AS baptized
       FROM people
      WHERE owner_id = $1 AND removed_at IS NULL`,
    [ownerId],
  );

  const [groups] = await query<{ active: number; archived: number }>(
    `SELECT count(*) FILTER (WHERE archived_at IS NULL)::int AS active,
            count(*) FILTER (WHERE archived_at IS NOT NULL)::int AS archived
       FROM groups
      WHERE owner_id = $1`,
    [ownerId],
  );

  const bookRows = await query<{
    book_id: string;
    book_number: number | null;
    book_title: string;
    completed_count: number;
  }>(
    `WITH book_sessions AS (
       SELECT b.id AS book_id,
              b.number AS book_number,
              b.title AS book_title,
              count(s.id) AS session_count
         FROM books b
         JOIN sessions s ON s.book_id = b.id AND s.retired_at IS NULL
        WHERE b.number IS NOT NULL
        GROUP BY b.id, b.number, b.title
     ),
     covered AS (
       SELECT c.person_id, s.book_id, count(DISTINCT s.id) AS covered_count
         FROM completions c
         JOIN people p ON p.id = c.person_id AND p.owner_id = $1 AND p.removed_at IS NULL
         JOIN sessions s ON s.id = c.session_id AND s.retired_at IS NULL
         JOIN meetings m ON m.id = c.meeting_id AND m.status <> 'cancelled'
        WHERE c.owner_id = $1 AND c.session_id IS NOT NULL
        GROUP BY c.person_id, s.book_id
     )
     SELECT bs.book_id,
            bs.book_number,
            bs.book_title,
            count(cov.person_id) FILTER (WHERE cov.covered_count = bs.session_count)::int
              AS completed_count
       FROM book_sessions bs
       LEFT JOIN covered cov ON cov.book_id = bs.book_id
      GROUP BY bs.book_id, bs.book_number, bs.book_title
      ORDER BY bs.book_number ASC`,
    [ownerId],
  );

  return {
    members: people.members,
    activeGroups: groups.active,
    archivedGroups: groups.archived,
    quiet: (await getQuietMembers(ownerId)).length,
    steppedAway: people.stepped_away,
    baptized: people.baptized,
    books: bookRows.map((row) => ({
      bookId: row.book_id,
      bookNumber: row.book_number,
      bookTitle: row.book_title,
      completedCount: row.completed_count,
    })),
  };
}

/* --------------------------------------------------------------------- CSV -- */

const MARK_LABEL: Record<"attended" | "present-only", string> = {
  attended: "Attended",
  "present-only": "Present only",
};

/** "6 of 6" — the same shape `display.ts` prints, kept here so a row is one cell. */
function coveredOf(covered: number, total: number): string {
  return `${covered} of ${total}`;
}

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

/**
 * The person sheet as a spreadsheet: a header block, the progress table, then
 * the attendance table. Ragged on purpose (`csv.ts` allows it) — a sheet is not
 * one table, and forcing it into one would bury the contact block.
 */
export function personReportToCsv(report: PersonReport): string {
  const p = report.person;
  return toCsv([
    ["Person sheet", p.name],
    ["Home BGroup", p.homeGroupName ?? ""],
    ["Spiritual status", p.spiritualStatus ?? ""],
    ["Baptized", p.baptized ? (p.baptizedOn ?? "Yes") : "No"],
    ["Joined", p.joinedOn],
    ["Birthday", p.birthday ?? ""],
    ["Address", p.address ?? ""],
    ["Civil status", p.civilStatus ?? ""],
    ["Invited by", p.invitedBy ?? ""],
    ["Phone", p.phone ?? ""],
    ["Email", p.email ?? ""],
    ["Stepped away", p.steppedAwayOn ?? ""],
    [],
    ["Progress"],
    ["Book", "Sessions covered", "Complete"],
    ...report.progress.map((book) => [
      bookLabel({ number: book.bookNumber, title: book.bookTitle }),
      coveredOf(book.coveredCount, book.sessionCount),
      yesNo(book.complete),
    ]),
    [],
    ["Attendance"],
    ["Date", "BGroup", "Guest visit", "Coverage", "Mark"],
    ...report.attendance.map((row) => [
      row.date,
      row.groupName,
      yesNo(row.guest),
      row.coverage,
      MARK_LABEL[row.mark],
    ]),
  ]);
}

/** The group history: the header block, the meetings table, the book roll-up. */
export function groupReportToCsv(report: GroupReport): string {
  return toCsv([
    ["Group history", report.group.name],
    ["Schedule", report.group.schedule],
    ["Current book", report.group.currentBookLabel ?? ""],
    ["Held", report.heldCount],
    ["Cancelled", report.cancelledCount],
    [],
    ["Meetings"],
    ["Date", "Status", "Coverage", "Attendance", "Guests", "Notes"],
    ...report.meetings.map((meeting) => [
      meeting.date,
      meeting.status === "held" ? "Held" : "Cancelled",
      meeting.coverage,
      meeting.status === "cancelled" ? "" : meeting.attendeeCount,
      meeting.guests
        .map((guest) => `${guest.name} (${guest.homeGroupName ?? "no BGroup"})`)
        .join("; "),
      meeting.notes ?? "",
    ]),
    [],
    ["Book progress"],
    ["Member", "Sessions covered", "Complete"],
    ...(report.bookProgress?.members ?? []).map((member) => [
      member.name,
      coveredOf(member.coveredCount, member.sessionCount),
      yesNo(member.complete),
    ]),
  ]);
}

/** The roll-up: the head counts, then the books-completed table. */
export function rollupToCsv(report: Rollup): string {
  return toCsv([
    ["Roll-up"],
    ["Members", report.members],
    ["Active BGroups", report.activeGroups],
    ["Archived BGroups", report.archivedGroups],
    ["Quiet", report.quiet],
    ["Baptized", report.baptized],
    ["Stepped away", report.steppedAway],
    [],
    ["Books completed"],
    ["Book", "Members completed"],
    ...report.books.map((book) => [
      bookLabel({ number: book.bookNumber, title: book.bookTitle }),
      book.completedCount,
    ]),
  ]);
}
