"use client";

/**
 * The COVERING panel's "Change" pill (`design/Attendance.dc.html`) — the
 * screen `AttendanceSheet.tsx`'s module note and `meetings/[id]/page.tsx`
 * both flagged as not existing yet. Only ever rendered for a still-PROPOSED
 * meeting: `changeMeetingSession` (#24) refuses a held one, so there is
 * nothing for this panel to do once a night is confirmed.
 *
 * Each session is its own tiny form rather than a `<select>` + submit button,
 * the same one-tap-per-row idiom `MeetingCard`'s past-due resolve uses — no
 * client state needed for the choice itself, only for whether the panel is
 * open.
 */
import { useState } from "react";

import type { CurriculumSession } from "@/lib/curriculum/books";
import { changeMeetingSessionAction } from "@/lib/meetings/actions";

/** The whole COVERING panel for a still-PROPOSED meeting, Change pill included. */
export function ChangeSessionPanel({
  meetingId,
  bookLabel,
  sessionNumber,
  sessionTitle,
  sessions,
  currentSessionId,
}: {
  meetingId: string;
  bookLabel: string;
  sessionNumber: number | null;
  sessionTitle: string | null;
  sessions: CurriculumSession[];
  currentSessionId: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3 rounded-[16px] bg-blue-tint px-[13px] py-[11px]">
      <div className="flex items-center gap-[10px]">
        <div className="min-w-0 grow">
          <div className="text-[10px] font-bold tracking-[0.13em] text-[#4A7BB7]">COVERING</div>
          <div className="mt-[2px] text-[15px] font-bold text-blue-deep">
            {sessionNumber === null
              ? `${bookLabel} — no session set`
              : `${bookLabel} · Session ${sessionNumber} — ${sessionTitle}`}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex h-10 shrink-0 items-center rounded-[12px] bg-card px-[15px] text-[14px] font-bold text-blue"
        >
          {open ? "Done" : "Change"}
        </button>
      </div>

      {open ? (
        <div className="mt-[11px] flex flex-col gap-[7px] border-t border-[#D3E1F1] pt-[11px]">
          {sessions.map((session) => (
            <SessionOption
              key={session.id}
              meetingId={meetingId}
              sessionId={session.id}
              label={`${session.number} — ${session.title}`}
              selected={session.id === currentSessionId}
            />
          ))}
          <SessionOption
            meetingId={meetingId}
            sessionId=""
            label="No lesson tonight"
            selected={currentSessionId === null}
          />
        </div>
      ) : null}
    </div>
  );
}

function SessionOption({
  meetingId,
  sessionId,
  label,
  selected,
}: {
  meetingId: string;
  sessionId: string;
  label: string;
  selected: boolean;
}) {
  return (
    <form action={changeMeetingSessionAction}>
      <input type="hidden" name="meetingId" value={meetingId} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <button
        type="submit"
        disabled={selected}
        className={`w-full rounded-[12px] border-[1.5px] px-[12px] py-[9px] text-left text-[14px] font-semibold ${
          selected ? "border-blue bg-blue-tint text-blue-deep" : "border-line-soft bg-[#FBF9F5] text-ink"
        }`}
      >
        {label}
      </button>
    </form>
  );
}
