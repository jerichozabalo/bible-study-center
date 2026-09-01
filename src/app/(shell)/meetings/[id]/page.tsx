/**
 * A meeting's attendance sheet — `design/Attendance.dc.html`.
 *
 * The header block is the board's: whose night it is, when, and what it covers.
 * The sheet itself is `components/attendance/AttendanceSheet.tsx`, which is
 * where the ticks live until they are saved.
 *
 * The board's COVERING panel has a "Change" pill beside the lesson. Editing a
 * meeting is issue 5's screen and does not exist, so the panel states the
 * agenda rather than offering a control that goes nowhere.
 *
 * Under the sheet, and drawn on no board, is #31's catch-up list: who from the
 * other BGroups is missing tonight's session. It sits after the sheet because
 * the room comes first — the ticks are what the leader opened this screen for.
 */
import { notFound } from "next/navigation";

import { AttendanceSheet } from "@/components/attendance/AttendanceSheet";
import { CatchUpList } from "@/components/attendance/CatchUpList";
import { BackRow } from "@/components/BackRow";
import { saveSheetAction } from "@/lib/attendance/actions";
import { getCatchUpCandidates } from "@/lib/attendance/catchup";
import { getSheet } from "@/lib/attendance/sheet";
import { requireUser } from "@/lib/auth/guard";
import { formatWeekdayDate } from "@/lib/dates";
import { formatTime } from "@/lib/roster/schedule";

/** Reads the session cookie and the roster — never prerendered. */
export const dynamic = "force-dynamic";

export default async function AttendancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const sheet = await getSheet(user.email, id);

  if (!sheet) notFound();

  const { meeting } = sheet;
  const candidates = await getCatchUpCandidates(user.email, meeting.id);

  return (
    <section className="pb-4">
      <BackRow href="/" />

      <div>
        <h2 className="text-[19px]">{meeting.groupName}</h2>
        <div className="mt-[2px] text-[13px] text-slate">
          {formatWeekdayDate(meeting.date)} · {formatTime(meeting.startTime)}
          {meeting.status === "held" ? " · held" : ""}
        </div>
      </div>

      {meeting.sessionId === null ? (
        /* #26, in the same words the new-meeting form's amber well uses: this
           night credits nothing and still counts as contact. */
        <div className="mt-3 rounded-[20px] bg-amber-well px-4 py-[15px]">
          <div className="text-[15px] font-bold text-amber-ink">No lesson tonight</div>
          <div className="mt-[5px] text-[14px] leading-[1.45] text-amber-ink">
            No session completions are recorded — but everyone you tick still counts as contact, so
            they stay off the quiet list.
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-[16px] bg-blue-tint px-[13px] py-[11px]">
          <div className="text-[10px] font-bold tracking-[0.13em] text-[#4A7BB7]">COVERING</div>
          <div className="mt-[2px] text-[15px] font-bold text-blue-deep">
            {/* A book of Jericho's own has no published number (#22), so it is
                named by its title where the GLC books are named by theirs. */}
            {meeting.bookNumber === null ? meeting.bookTitle : `Book ${meeting.bookNumber}`} ·
            Session {meeting.sessionNumber} — {meeting.sessionTitle}
          </div>
        </div>
      )}

      <AttendanceSheet
        action={saveSheetAction}
        meetingId={meeting.id}
        people={sheet.people}
        sessionNumber={meeting.sessionNumber}
        held={meeting.status === "held"}
      />

      <CatchUpList
        candidates={candidates}
        sessionNumber={meeting.sessionNumber}
        sessionTitle={meeting.sessionTitle}
      />
    </section>
  );
}
