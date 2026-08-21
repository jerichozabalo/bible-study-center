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
import Link from "next/link";
import { useActionState } from "react";

import type { GroupFormState } from "@/lib/roster/actions";
import type { GroupFormValues } from "@/lib/roster/form";
import { WEEKDAY_NAMES, formatDuration } from "@/lib/roster/schedule";

export type BookOption = {
  id: string;
  label: string;
  /** The program heading this book sits under; null for a book of Jericho's own. */
  programName: string | null;
};

export type { GroupFormValues };

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

  // After a refusal the server hands back what was submitted, so the day, time,
  // duration and book the leader already chose survive a typo in the name. On a
  // first paint there is no state yet and the caller's values are the answer.
  const shown = state.values ?? values;

  return (
    <form action={formAction} className="pt-1 pb-2">
      {groupId ? <input type="hidden" name="id" value={groupId} /> : null}

      {/* The board's attention pair, not the field treatment. A white card with
          a `#E6DFD4` hairline is exactly how every input below renders, so the
          refusal read as one more text field rather than as a problem (QA pass,
          2026-08-21). Amber is what the artboards use to mean "look here". */}
      {state.error ? (
        <p
          id="group-form-error"
          role="alert"
          className="mb-4 flex items-start gap-[9px] rounded-[18px] bg-amber-well px-4 py-3 text-[14.5px] leading-[1.45] text-amber-ink"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-[2px] shrink-0"
            aria-hidden="true"
          >
            <path d="M12 8v5M12 16.5v.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
          {state.error}
        </p>
      ) : null}

      <label className={`${EYEBROW} block`} htmlFor="group-name">
        NAME
      </label>
      {/* Every refusal this form can produce today is about the name, so the
          field carries the error rather than only the banner announcing it —
          otherwise a screen reader hears the problem and then meets an input
          with nothing wrong with it. */}
      <input
        id="group-name"
        name="name"
        type="text"
        defaultValue={shown.name}
        placeholder="BGroup Linggo"
        autoComplete="off"
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? "group-form-error" : undefined}
        className={`${FIELD} mt-[9px] ${state.error ? "border-amber-ink" : ""}`}
      />

      <div className={`${EYEBROW} mt-[22px]`}>WEEKLY SCHEDULE</div>
      <div className="mt-[9px] flex gap-[8px]">
        <select
          name="weekday"
          aria-label="Day"
          defaultValue={String(shown.weekday)}
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
          defaultValue={shown.startTime}
          className={`${FIELD} w-[136px]`}
        />
      </div>
      <select
        name="durationMinutes"
        aria-label="How long it runs"
        defaultValue={String(shown.durationMinutes)}
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
        defaultValue={shown.currentBookId ?? ""}
        className={`${FIELD} mt-[9px]`}
      >
        {/* The same words the card and the detail screen use for the same
            state. #66 is one word per thing, and "Not chosen yet" here against
            "No book chosen yet" everywhere else was two. */}
        <option value="">No book chosen yet</option>
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

      {/* Issue 13's entry point, at the end of the picker: the curriculum is
          encountered here and nowhere else in v1, so this is where a book of
          Jericho's own has to start. It leads to the list of his own books,
          which both adds one and is the only place one can be edited — a link
          straight to the form would leave the editing screen unreachable. */}
      <Link
        href="/books"
        className="mt-[11px] flex h-11 w-fit items-center gap-[6px] rounded-[14px] text-[14.5px] font-bold text-blue active:bg-shell"
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#1D4E89"
          strokeWidth="2.4"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add your own book
      </Link>

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
