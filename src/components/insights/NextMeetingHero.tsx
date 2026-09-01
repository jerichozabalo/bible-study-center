/**
 * Home's blue hero — `design/Main.dc.html`'s "NEXT MEETING" card (#20).
 *
 * It is the one meeting the leader most likely needs right now: the soonest
 * upcoming night that has not been cancelled (#50 keeps cancelled nights off
 * "what is next"). Its button opens that meeting's attendance sheet — taking
 * attendance is what marks a proposed night held (#47), so the same button
 * serves whether tonight's meeting is still proposed or already held.
 *
 * A pure server component: it draws what the page already loaded and holds no
 * state. The board's "Didn't meet tonight" shortcut is a resolve action (#52,
 * issue 5's `cancelMeeting`) and is left to the calendar for now.
 */
import Link from "next/link";

import { formatWeekdayDate, manilaToday } from "@/lib/dates";
import type { MeetingSummary } from "@/lib/meetings/meetings";
import { formatTime } from "@/lib/roster/schedule";

export function NextMeetingHero({ meeting }: { meeting: MeetingSummary }) {
  const tonight = meeting.date === manilaToday();
  const covering =
    meeting.sessionNumber === null
      ? { label: "Fellowship night", detail: "No session — nothing to cover" }
      : {
          label: `Book ${meeting.bookNumber} · Session ${meeting.sessionNumber}`,
          detail: meeting.sessionTitle ?? "",
        };

  return (
    <div className="rounded-[24px] bg-blue p-5 text-white">
      <div className="flex items-center gap-[7px]">
        <span className="h-[7px] w-[7px] rounded-[4px] bg-mint" />
        <span className="text-[11px] font-bold tracking-[0.13em] text-blue-pale">
          NEXT MEETING{tonight ? " · TONIGHT" : ""}
        </span>
      </div>

      <h2 className="mt-[9px] text-[27px] text-white">{meeting.groupName}</h2>
      <div className="mt-[5px] text-[15px] text-blue-soft">
        {formatTime(meeting.startTime)} · {formatWeekdayDate(meeting.date)}
      </div>

      <div className="mt-[15px] rounded-[16px] bg-white/[0.13] px-[15px] py-[13px]">
        <div className="text-[10px] font-bold tracking-[0.13em] text-blue-pale">COVERING</div>
        <div className="mt-[4px] text-[16px] font-bold">{covering.label}</div>
        {covering.detail ? (
          <div className="mt-[1px] text-[14px] text-blue-soft">{covering.detail}</div>
        ) : null}
      </div>

      <Link
        href={`/meetings/${meeting.id}`}
        className="mt-4 flex h-[58px] w-full items-center justify-center gap-[9px] rounded-[18px] bg-white text-[17px] font-bold text-blue-deep active:bg-shell"
      >
        <svg
          width="21"
          height="21"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#143761"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
        Mark attendance
      </Link>
    </div>
  );
}
