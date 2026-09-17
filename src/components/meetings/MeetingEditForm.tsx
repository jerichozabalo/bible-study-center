"use client";

/**
 * Edit a meeting's own facts — date, time, duration, notes (#75, 2026-09-17).
 * Book and session are `ChangeSessionPanel`'s; the BGroup is not editable here
 * at all — moving a meeting to a different BGroup would make it a different
 * meeting, not a correction of this one.
 *
 * Carries #48's same toggle the create form has: "Every week from now on"
 * also sets the BGroup's own schedule and shifts its other still-PROPOSED
 * meetings onto the new day/time. Without it, editing one meeting reads as a
 * one-off — the night moved this week only — and every other proposed night
 * keeps generating on the old schedule, which is exactly the bug this closes
 * (2026-09-17): editing Jimenez Family's meeting day and time did not move
 * their other proposed meetings, because nothing told the BGroup to move.
 *
 * Same field idiom as `GroupForm`/`NewMeetingForm`: eyebrow labels over
 * white cards with a hairline border. Unrestricted by status on purpose — a
 * HELD night can be the wrong one outright, not just wrong-session.
 */
import Link from "next/link";
import { useActionState, useState } from "react";

import type { MeetingFormState } from "@/lib/meetings/actions";
import { weekdayOf } from "@/lib/dates";
import { formatDuration, formatTime, weekdayPlural } from "@/lib/roster/schedule";

/** The lengths a night actually runs, in minutes — same list `GroupForm` uses. */
const DURATIONS = [45, 60, 75, 90, 105, 120, 150, 180];

const EYEBROW = "text-[11px] font-bold tracking-[0.13em] text-tan";
const FIELD =
  "h-[54px] w-full rounded-[18px] border-[1.5px] border-line bg-card px-[13px] text-[15.5px] font-semibold text-ink";
const CARD = "w-full rounded-[18px] border-[1.5px] border-line bg-card px-[14px] py-[13px]";

export function MeetingEditForm({
  action,
  meetingId,
  groupName,
  values,
}: {
  action: (state: MeetingFormState, formData: FormData) => Promise<MeetingFormState>;
  meetingId: string;
  groupName: string;
  values: { date: string; startTime: string; durationMinutes: number; notes: string | null };
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [date, setDate] = useState(values.date);
  const [startTime, setStartTime] = useState(values.startTime.slice(0, 5));
  const [repeatWeekly, setRepeatWeekly] = useState(false);

  return (
    <form action={formAction} className="pt-1 pb-2">
      <input type="hidden" name="meetingId" value={meetingId} />
      {repeatWeekly ? <input type="hidden" name="repeatWeekly" value="on" /> : null}

      {state.error ? (
        <p
          role="alert"
          className="mb-4 rounded-[18px] bg-amber-well px-4 py-3 text-[14.5px] leading-[1.45] text-amber-ink"
        >
          {state.error}
        </p>
      ) : null}

      <label className={`${EYEBROW} block`} htmlFor="meeting-edit-date">
        DATE
      </label>
      <input
        id="meeting-edit-date"
        type="date"
        name="date"
        value={date}
        onChange={(event) => setDate(event.target.value)}
        className={`${FIELD} mt-[9px]`}
      />

      <div className={`${EYEBROW} mt-[22px]`}>TIME</div>
      <div className="mt-[9px] flex gap-[8px]">
        <input
          type="time"
          name="startTime"
          aria-label="Start time"
          value={startTime}
          onChange={(event) => setStartTime(event.target.value)}
          className={`${FIELD} w-[136px]`}
        />
        <select
          name="durationMinutes"
          aria-label="How long it runs"
          defaultValue={values.durationMinutes}
          className={`${FIELD} grow`}
        >
          {DURATIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {formatDuration(minutes)}
            </option>
          ))}
        </select>
      </div>

      {/* #48: one recurrence per BGroup, and this is one of the two places it
          can be set (the other is the create form). The note names exactly
          what would be saved, because this writes to the BGroup and not only
          to this one night. */}
      <button
        type="button"
        onClick={() => setRepeatWeekly(!repeatWeekly)}
        className={`${CARD} mt-[14px] flex items-center gap-[13px]`}
      >
        <span className="min-w-0 grow text-left">
          <span className="block text-[15.5px] font-bold">Every week from now on</span>
          <span className="mt-[2px] block text-[13px] text-slate">
            {repeatWeekly
              ? `${groupName} meets ${weekdayPlural(weekdayOf(date))} ${formatTime(startTime)} from now on`
              : `Just this one night — ${groupName}'s other meetings keep their own day and time`}
          </span>
        </span>
        <Switch on={repeatWeekly} />
      </button>

      <label className={`${EYEBROW} mt-[22px] block`} htmlFor="meeting-edit-notes">
        NOTES
      </label>
      <textarea
        id="meeting-edit-notes"
        name="notes"
        rows={3}
        defaultValue={values.notes ?? ""}
        placeholder="Where you met if it moved, or anything worth remembering about tonight."
        className={`${CARD} mt-[9px] min-h-[86px] resize-none text-[14.5px] leading-[1.5] text-ink placeholder:text-[#968871b0]`}
      />

      <button
        type="submit"
        disabled={pending}
        className="mt-[26px] flex h-[58px] w-full items-center justify-center rounded-[18px] bg-blue text-[17px] font-bold text-white active:bg-blue-deep disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
      <Link
        href={`/meetings/${meetingId}`}
        className="mt-[9px] flex h-[54px] w-full items-center justify-center rounded-[17px] text-[15.5px] font-bold text-slate active:bg-shell"
      >
        Cancel
      </Link>
    </form>
  );
}

/** The board's 54×32 switch — same shape `NewMeetingForm`'s own draws. */
function Switch({ on }: { on: boolean }) {
  return (
    <span
      className={`flex h-8 w-[54px] shrink-0 items-center rounded-[18px] p-[3px] ${
        on ? "justify-end bg-blue" : "justify-start bg-track"
      }`}
    >
      <span className="h-[26px] w-[26px] rounded-[14px] bg-card" />
    </span>
  );
}
