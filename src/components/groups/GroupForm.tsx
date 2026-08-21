"use client";

/**
 * The one form behind both "New BGroup" and editing an existing one — a group's
 * whole definition is its name, its weekly schedule (#36) and its current book
 * (#17), so two screens with the same five fields would only ever drift.
 *
 * No artboard draws this screen. The idiom is `design/NewMeeting.dc.html`'s:
 * eyebrow labels over white cards with a hairline border, and a full-width blue
 * button. That board pins its button to the bottom of the screen — here it
 * cannot, because #62 put a tab bar there; it sits at the end of the form
 * instead.
 *
 * A client component for one reason: `useActionState`, which is how the
 * validation message from the server gets back onto the screen. The form still
 * posts and works without JavaScript.
 */
import { useActionState } from "react";

import type { GroupFormState } from "@/lib/roster/actions";
import { WEEKDAY_NAMES, formatDuration } from "@/lib/roster/schedule";

export type BookOption = {
  id: string;
  label: string;
  /** The program heading this book sits under; null for a book of Jericho's own. */
  programName: string | null;
};

export type GroupFormValues = {
  name: string;
  weekday: number;
  /** `HH:MM` for the time input. */
  startTime: string;
  durationMinutes: number;
  currentBookId: string | null;
};

/** The lengths a BGroup night actually runs, in minutes. */
const DURATIONS = [45, 60, 75, 90, 105, 120, 150, 180];

const FIELD =
  "h-[54px] w-full rounded-[18px] border-[1.5px] border-line bg-card px-[13px] text-[15.5px] font-semibold text-ink";
const EYEBROW = "text-[11px] font-bold tracking-[0.13em] text-tan";

export function GroupForm({
  action,
  books,
  values,
  submitLabel,
  groupId,
}: {
  action: (state: GroupFormState, formData: FormData) => Promise<GroupFormState>;
  books: BookOption[];
  values: GroupFormValues;
  submitLabel: string;
  groupId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const programs = [...new Set(books.map((book) => book.programName))];

  return (
    <form action={formAction} className="pt-1 pb-2">
      {groupId ? <input type="hidden" name="id" value={groupId} /> : null}

      {state.error ? (
        <p
          role="alert"
          className="mb-4 rounded-[18px] border border-line bg-card px-4 py-3 text-[14.5px] leading-[1.45] text-ink"
        >
          {state.error}
        </p>
      ) : null}

      <label className={`${EYEBROW} block`} htmlFor="group-name">
        NAME
      </label>
      <input
        id="group-name"
        name="name"
        type="text"
        defaultValue={values.name}
        placeholder="BGroup Linggo"
        autoComplete="off"
        className={`${FIELD} mt-[9px]`}
      />

      <div className={`${EYEBROW} mt-[22px]`}>WEEKLY SCHEDULE</div>
      <div className="mt-[9px] flex gap-[8px]">
        <select
          name="weekday"
          aria-label="Day"
          defaultValue={String(values.weekday)}
          className={`${FIELD} grow`}
        >
          {WEEKDAY_NAMES.map((day, index) => (
            <option key={day} value={index}>
              {day}s
            </option>
          ))}
        </select>
        <input
          name="startTime"
          type="time"
          aria-label="Start time"
          defaultValue={values.startTime}
          className={`${FIELD} w-[136px]`}
        />
      </div>
      <select
        name="durationMinutes"
        aria-label="How long it runs"
        defaultValue={String(values.durationMinutes)}
        className={`${FIELD} mt-[8px]`}
      >
        {DURATIONS.map((minutes) => (
          <option key={minutes} value={minutes}>
            {formatDuration(minutes)}
          </option>
        ))}
      </select>
      <p className="mt-[7px] text-[12.5px] leading-[1.45] text-tan">
        The app proposes this night every week once the calendar is on.
      </p>

      <label className={`${EYEBROW} mt-[22px] block`} htmlFor="group-book">
        CURRENT BOOK
      </label>
      <select
        id="group-book"
        name="currentBookId"
        defaultValue={values.currentBookId ?? ""}
        className={`${FIELD} mt-[9px]`}
      >
        <option value="">Not chosen yet</option>
        {programs.map((program) => {
          const inProgram = books.filter((book) => book.programName === program);
          return program === null ? (
            inProgram.map((book) => (
              <option key={book.id} value={book.id}>
                {book.label}
              </option>
            ))
          ) : (
            <optgroup key={program} label={program}>
              {inProgram.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.label}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>
      <p className="mt-[7px] text-[12.5px] leading-[1.45] text-tan">
        The group carries the book, not each member. You can change it later.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="mt-[26px] flex h-[58px] w-full items-center justify-center rounded-[18px] bg-blue text-[17px] font-bold text-white active:bg-blue-deep disabled:opacity-60"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
