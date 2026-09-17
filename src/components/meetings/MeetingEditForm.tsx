"use client";

/**
 * Edit a meeting's own facts — date, time, duration, notes (#75, 2026-09-17).
 * Book and session are `ChangeSessionPanel`'s; the BGroup is not editable here
 * at all — moving a meeting to a different BGroup would make it a different
 * meeting, not a correction of this one.
 *
 * Same field idiom as `GroupForm`/`NewMeetingForm`: eyebrow labels over
 * white cards with a hairline border. Unrestricted by status on purpose — a
 * HELD night can be the wrong one outright, not just wrong-session.
 */
import Link from "next/link";
import { useActionState } from "react";

import type { MeetingFormState } from "@/lib/meetings/actions";
import { formatDuration } from "@/lib/roster/schedule";

/** The lengths a night actually runs, in minutes — same list `GroupForm` uses. */
const DURATIONS = [45, 60, 75, 90, 105, 120, 150, 180];

const EYEBROW = "text-[11px] font-bold tracking-[0.13em] text-tan";
const FIELD =
  "h-[54px] w-full rounded-[18px] border-[1.5px] border-line bg-card px-[13px] text-[15.5px] font-semibold text-ink";
const CARD = "w-full rounded-[18px] border-[1.5px] border-line bg-card px-[14px] py-[13px]";

export function MeetingEditForm({
  action,
  meetingId,
  values,
}: {
  action: (state: MeetingFormState, formData: FormData) => Promise<MeetingFormState>;
  meetingId: string;
  values: { date: string; startTime: string; durationMinutes: number; notes: string | null };
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="pt-1 pb-2">
      <input type="hidden" name="meetingId" value={meetingId} />

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
        defaultValue={values.date}
        className={`${FIELD} mt-[9px]`}
      />

      <div className={`${EYEBROW} mt-[22px]`}>TIME</div>
      <div className="mt-[9px] flex gap-[8px]">
        <input
          type="time"
          name="startTime"
          aria-label="Start time"
          defaultValue={values.startTime.slice(0, 5)}
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
