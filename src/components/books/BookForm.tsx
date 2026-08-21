"use client";

/**
 * The one form behind "Add your own book" and editing one afterwards (#22) — a
 * custom book is its name and its ordered session titles, and two screens with
 * the same two fields would only ever drift.
 *
 * No artboard draws this screen. The idiom is the one `GroupForm` already took
 * from `design/NewMeeting.dc.html`: eyebrow labels over white cards with a
 * hairline border, amber for a refusal, a full-width blue button at the end of
 * the form rather than pinned to a bottom the tab bar now owns (#62).
 *
 * A client component for two reasons: `useActionState`, which is how the
 * server's refusal gets back onto the screen, and the session rows, which are
 * added and removed without a round trip. Without JavaScript the form still
 * renders, still renames, and still fills the spare row at the end — only
 * adding a second row and removing one need the buttons.
 */
import { useActionState, useState } from "react";

import type { BookFormState } from "@/lib/curriculum/actions";
import type { BookFormValues } from "@/lib/curriculum/form";

export type { BookFormValues };

type Row = { key: number; id: string | null; title: string };

const FIELD =
  "h-[54px] w-full rounded-[18px] border-[1.5px] border-line bg-card px-[13px] text-[15.5px] font-semibold text-ink";
const EYEBROW = "text-[11px] font-bold tracking-[0.13em] text-tan";

export function BookForm({
  action,
  values,
  submitLabel,
  bookId,
}: {
  action: (state: BookFormState, formData: FormData) => Promise<BookFormState>;
  values: BookFormValues;
  submitLabel: string;
  bookId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [rows, setRows] = useState<Row[]>(() => withSpare(values.sessions));

  // After a refusal the server hands back everything that was posted, and the
  // rows have to become that — otherwise a blank title costs the leader every
  // session they had just typed.
  const [restored, setRestored] = useState(state.values);
  if (state.values !== restored) {
    setRestored(state.values);
    if (state.values) setRows(withSpare(state.values.sessions));
  }

  const shownTitle = state.values?.title ?? values.title;

  return (
    <form action={formAction} className="pt-1 pb-2">
      {bookId ? <input type="hidden" name="id" value={bookId} /> : null}

      {state.error ? (
        <p
          id="book-form-error"
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

      <label className={`${EYEBROW} block`} htmlFor="book-title">
        BOOK NAME
      </label>
      <input
        id="book-title"
        name="title"
        type="text"
        defaultValue={shownTitle}
        placeholder="Kingdom Parables"
        autoComplete="off"
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? "book-form-error" : undefined}
        className={`${FIELD} mt-[9px] ${state.error ? "border-amber-ink" : ""}`}
      />
      <p className="mt-[7px] text-[12.5px] leading-[1.45] text-tan">
        Your own book sits beside the GLC books everywhere they appear. It belongs to no program.
      </p>

      <div className={`${EYEBROW} mt-[22px]`}>SESSIONS, IN ORDER</div>
      <div className="mt-[9px] flex flex-col gap-[8px]">
        {rows.map((row, index) => (
          <div key={row.key} className="flex items-center gap-[8px]">
            <span className="w-[22px] shrink-0 text-center text-[13px] font-bold text-tan">
              {index + 1}
            </span>
            <input type="hidden" name="sessionId" value={row.id ?? ""} />
            <input
              name="sessionTitle"
              type="text"
              aria-label={`Session ${index + 1}`}
              defaultValue={row.title}
              placeholder="The Sower"
              autoComplete="off"
              className={`${FIELD} grow`}
            />
            <button
              type="button"
              aria-label={`Remove session ${index + 1}`}
              onClick={() => setRows((current) => current.filter((other) => other.key !== row.key))}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-tan active:bg-shell"
            >
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() =>
          setRows((current) => [...current, { key: nextKey(current), id: null, title: "" }])
        }
        className="mt-[10px] flex h-[50px] w-full items-center justify-center gap-[6px] rounded-[18px] border-[1.5px] border-dashed border-line text-[15px] font-bold text-blue active:bg-shell"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#1D4E89"
          strokeWidth="2.4"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add another session
      </button>
      <p className="mt-[7px] text-[12.5px] leading-[1.45] text-tan">
        A session removed here is kept in the records of anyone who already covered it — it just
        stops being part of the book.
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

/**
 * The rows to render: what is there, plus one empty one at the end. The spare
 * row is what makes a session addable without JavaScript, and on a new book it
 * is the whole form.
 */
function withSpare(sessions: BookFormValues["sessions"]): Row[] {
  const rows = sessions.map((session, index) => ({
    key: index,
    id: session.id,
    title: session.title,
  }));
  return [...rows, { key: rows.length, id: null, title: "" }];
}

function nextKey(rows: Row[]): number {
  return rows.reduce((highest, row) => Math.max(highest, row.key), -1) + 1;
}
