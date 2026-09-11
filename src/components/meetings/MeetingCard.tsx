/**
 * One meeting card — the calendar agenda's, now shared (bst-v1.2 #1).
 *
 * Extracted from `CalendarView.tsx` so the Meeting page's List and the day
 * agenda draw one card and cannot drift: past-due proposed meetings (#52)
 * carry the NEEDS CONFIRMING pill and the one-tap Yes / Cancelled resolve,
 * held meetings the green check and the way into the sheet, cancelled
 * meetings are greyed and struck through (#50).
 *
 * Deliberately directive-free — the agenda renders it inside a client
 * component, the log renders it on the server; both graphs may import it.
 * The prop type is structural so both `CalendarEntry` and `MeetingSummary`
 * satisfy it.
 */
import Link from "next/link";

import { resolveMeetingAction } from "@/lib/meetings/calendar-actions";
import { formatTime } from "@/lib/roster/schedule";

/** The fields the card draws — both summary shapes in the app satisfy it. */
export type MeetingCardMeeting = {
  id: string;
  groupId: string;
  groupName: string;
  date: string;
  startTime: string;
  bookNumber: number | null;
  sessionNumber: number | null;
  sessionTitle: string | null;
  status: "proposed" | "held" | "cancelled";
};

export function MeetingCard({ meeting, today }: { meeting: MeetingCardMeeting; today: string }) {
  const isPastDue = meeting.status === "proposed" && meeting.date < today;
  const isCancelled = meeting.status === "cancelled";
  const isHeld = meeting.status === "held";

  const timeStr = formatTime(meeting.startTime);
  const sessionStr =
    meeting.sessionNumber === null
      ? "No session — fellowship night"
      : `Book ${meeting.bookNumber} · Session ${meeting.sessionNumber} — ${meeting.sessionTitle}`;

  // Bar colour, text colour, strikethrough, pill — derived from the status.
  let barColor = "#E7EFF9";
  let nameColor = "#14202E";
  let textDec = "none";
  let pillShow = false;
  let pillLabel = "";
  let pillBg = "#E7EFF9";
  let pillInk = "#1D4E89";

  if (isCancelled) {
    barColor = "#EDEAE3";
    nameColor = "#A4998A";
    textDec = "line-through";
    pillShow = true;
    pillLabel = "CANCELLED";
    pillBg = "#EDEAE3";
    pillInk = "#8B7B63";
  } else if (isHeld) {
    barColor = "#E7EFF9";
    pillShow = true;
    pillLabel = "HELD";
    pillBg = "#E4F1E9";
    pillInk = "#2E7D52";
  } else if (isPastDue) {
    barColor = "#1D4E89"; // #52: a proposed night still owed a decision — a live accent, not a blank bar
    pillShow = true;
    pillLabel = "NEEDS CONFIRMING";
    pillBg = "#FBF0DC";
    pillInk = "#9A5B0B";
  }

  // Tapping the card opens the meeting's attendance sheet (issue 6) — the way
  // in for any meeting, past or upcoming, until issue 8's Home hero exists.
  // Ticking the sheet is what marks a proposed night held (#47). A cancelled
  // meeting has nothing to take, so its header is inert.
  const header = (
    <>
      <div className="flex items-center gap-[7px]">
        <span
          className="text-[16px] font-bold leading-[1.2]"
          style={{ color: nameColor, textDecoration: textDec }}
        >
          {meeting.groupName}
        </span>
        {pillShow && (
          <span
            className="shrink-0 rounded-[7px] px-[7px] py-[3px] text-[10px] font-bold uppercase"
            style={{ backgroundColor: pillBg, color: pillInk }}
          >
            {pillLabel}
          </span>
        )}
      </div>
      <div
        className="mt-[4px] text-[13.5px] text-slate"
        style={{ textDecoration: textDec }}
      >
        {timeStr} · {sessionStr}
      </div>
    </>
  );

  return (
    <div
      className={
        "rounded-[20px] border-[1.5px] p-[13px] pb-[14px] " +
        (isPastDue ? "" : "border-line bg-card")
      }
      // #52: a past-due night sits in an amber well — the same idiom the
      // attendance sheet's "did it push through?" prompt uses.
      style={isPastDue ? { backgroundColor: "#FDF8EE", borderColor: "#F0E3C8" } : undefined}
    >
      <div className="flex items-start gap-[11px]">
        <div className="w-[4px] flex-shrink-0 rounded-[3px]" style={{ backgroundColor: barColor }} />
        <div className="min-w-0 flex-grow">
          {isCancelled ? (
            header
          ) : (
            <Link href={`/meetings/${meeting.id}`} className="block">
              {header}
            </Link>
          )}

          {/* Past-due confirmation buttons (#52) — a sibling of the link, never
              nested in it (a <form> inside an <a> is invalid). */}
          {isPastDue && <PastDueActions meeting={meeting} />}

          {/* Held meeting: a check and the way back to the sheet. */}
          {isHeld && (
            <Link
              href={`/meetings/${meeting.id}`}
              className="mt-[11px] flex items-center gap-[7px]"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#2E7D52"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              <span className="text-[13px] font-bold text-[#2E7D52]">
                Held — open the sheet
              </span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/** The Yes / Cancelled buttons that appear under a past-due proposed meeting. */
function PastDueActions({ meeting }: { meeting: MeetingCardMeeting }) {
  return (
    <div className="mt-[12px] border-t border-[#F0E3C8] pt-[12px]">
      <p className="mb-[9px] text-[12.5px] font-semibold text-amber-ink">
        This date has passed. Did it push through?
      </p>
      <div className="flex gap-[8px]">
        <form action={resolveMeetingAction} className="flex-1">
          <input type="hidden" name="groupId" value={meeting.groupId} />
          <input type="hidden" name="date" value={meeting.date} />
          <input type="hidden" name="status" value="held" />
          <button
            type="submit"
            className="flex h-[42px] w-full items-center justify-center rounded-[14px] bg-blue text-[14px] font-bold text-white"
          >
            Yes, mark held
          </button>
        </form>
        <form action={resolveMeetingAction} className="flex-1">
          <input type="hidden" name="groupId" value={meeting.groupId} />
          <input type="hidden" name="date" value={meeting.date} />
          <input type="hidden" name="status" value="cancelled" />
          <button
            type="submit"
            className="flex h-[42px] w-full items-center justify-center rounded-[14px] border border-line bg-card text-[14px] font-bold text-slate"
          >
            Cancelled
          </button>
        </form>
      </div>
    </div>
  );
}

