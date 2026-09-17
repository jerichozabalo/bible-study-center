/**
 * A meeting's attendance sheet — `design/Attendance.dc.html`.
 *
 * The header block is the board's: whose night it is, when, and what it covers.
 * The sheet itself is `components/attendance/AttendanceSheet.tsx`, which is
 * where the ticks live until they are saved.
 *
 * The board's COVERING panel has a "Change" pill beside the lesson.
 * `ChangeSessionPanel` is that screen, only for a still-PROPOSED meeting: #24
 * keeps a HELD one's session locked, so a held night's panel below is a plain
 * div with no control.
 *
 * Drawn on no board is #31's catch-up list: who from the other BGroups is
 * missing tonight's session, each with an "Add to tonight" button. It renders
 * at the end of `AttendanceSheet`'s form (issue 17) so that button can carry
 * the ticks already made; the roster is passed straight through for the "Add
 * someone else" ride-along search.
 *
 * Below the sheet sits the photos card (bst-v1.1 issue 4): take or upload with
 * ONE consent tick per batch, delete to retract — and a plain "not set up yet"
 * state while R2 is unconfigured, so the screen never pretends.
 */
import Link from "next/link";
import { notFound } from "next/navigation";

import { AttendanceSheet } from "@/components/attendance/AttendanceSheet";
import { BackRow } from "@/components/BackRow";
import { ChangeSessionPanel } from "@/components/meetings/ChangeSessionPanel";
import { saveSheetAction } from "@/lib/attendance/actions";
import { getCatchUpCandidates } from "@/lib/attendance/catchup";
import { getSheet } from "@/lib/attendance/sheet";
import { requireUser } from "@/lib/auth/guard";
import { getBook } from "@/lib/curriculum/books";
import { formatWeekdayDate } from "@/lib/dates";
import { listPeople } from "@/lib/roster/people";
import { formatTime } from "@/lib/roster/schedule";
import { listPhotosForSession, signPhotoUrls } from "@/lib/session-photos/photos";
import { isStorageConfigured } from "@/lib/session-photos/storage";

/** Reads the session cookie and the roster — never prerendered. */
export const dynamic = "force-dynamic";

export default async function AttendancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const sheet = await getSheet(user.email, id);

  if (!sheet) notFound();

  const { meeting } = sheet;
  const storageReady = isStorageConfigured();
  const [candidates, roster, photos, book] = await Promise.all([
    getCatchUpCandidates(user.email, meeting.id),
    listPeople(user.email),
    listPhotosForSession(user.email, meeting.id),
    // Only needed to offer the Change panel's session list — a held meeting's
    // session is locked (#24), so this stays null and unused for one.
    meeting.status === "proposed" && meeting.bookId !== null
      ? getBook(meeting.bookId)
      : Promise.resolve(null),
  ]);
  const signedPhotos = storageReady ? await signPhotoUrls(photos) : [];

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
      ) : meeting.status === "proposed" && book !== null ? (
        // Only a still-PROPOSED night is still a guess (#53) — the Change pill
        // that edits it. #24 keeps a HELD night's session locked, so once the
        // sheet is confirmed the panel below is what draws instead.
        <ChangeSessionPanel
          meetingId={meeting.id}
          bookLabel={meeting.bookNumber === null ? (meeting.bookTitle ?? "") : `Book ${meeting.bookNumber}`}
          sessionNumber={meeting.sessionNumber}
          sessionTitle={meeting.sessionTitle}
          sessions={book.sessions}
          currentSessionId={meeting.sessionId}
        />
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
        roster={roster}
        catchUpCandidates={candidates}
        sessionNumber={meeting.sessionNumber}
        sessionTitle={meeting.sessionTitle}
        held={meeting.status === "held"}
        meetingDate={meeting.date}
        photos={signedPhotos}
        storageReady={storageReady}
      />

      {/* Edit and Delete (#75, 2026-09-17) — the same stacked-links idiom the
          BGroup detail screen uses for its own edit/archive pair. Unrestricted
          by status: a HELD night can be the wrong one outright. */}
      <div className="mt-[22px] flex flex-col gap-[9px]">
        <Link
          href={`/meetings/${meeting.id}/edit`}
          className="flex h-[54px] w-full items-center justify-center rounded-[17px] border-[1.5px] border-line bg-card text-[15.5px] font-bold text-ink active:bg-shell"
        >
          Edit meeting
        </Link>
        <Link
          href={`/meetings/${meeting.id}/delete`}
          className="flex h-[54px] w-full items-center justify-center rounded-[17px] text-[15.5px] font-bold text-tan active:bg-shell"
        >
          Delete meeting
        </Link>
      </div>
    </section>
  );
}
