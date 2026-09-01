"use client";

/**
 * One book's progress for one person — `design/Person.dc.html`'s progress card:
 * the title and its status line, the dot row, and the session list the chevron
 * opens.
 *
 * Two things the board could not show:
 *
 * - **The dots wrap at six (#68).** The board draws six-session books only, and
 *   its row is a `flex-wrap` that would fit seven across at 390px and leave
 *   Book 8's twelve as 7 + 5. A six-column grid is what the decision actually
 *   says, and it keeps a cell the same size in every book — which was the other
 *   half of #68's complaint. Twelve sessions are two full rows.
 * - **"before she joined"**, on the board's own mock row, is written here as
 *   "before they joined": the app does not know anyone's gender and never asks
 *   (#9b's fields).
 *
 * It is a client component for the chevron alone. Nothing here is fetched or
 * posted — the whole card arrives as one derived object (#70 server-first).
 */
import { useState } from "react";

import { columnsFor } from "@/components/insights/dots";
import { bookLabel } from "@/lib/curriculum/books";
import { bookStatusLine, dotState, sessionWhen } from "@/lib/insights/display";
import type { BookProgress, SessionProgress } from "@/lib/insights/progress";

export function BookProgressCard({
  book,
  defaultOpen = false,
}: {
  book: BookProgress;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const title = bookLabel({ number: book.bookNumber, title: book.bookTitle });

  return (
    <div className="rounded-[20px] border border-line bg-card px-[15px] py-[14px]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-[11px] text-left"
      >
        <div className="min-w-0 grow">
          <div
            className={`text-[15.5px] font-bold ${
              book.coveredCount === 0 ? "text-tan" : "text-ink"
            }`}
          >
            {title}
          </div>
          <div className="mt-[2px] text-[13px] text-slate">{bookStatusLine(book)}</div>
        </div>
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#C3B8A5"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
          aria-hidden="true"
        >
          <path d={open ? "m18 15-6-6-6 6" : "m6 9 6 6 6-6"} />
        </svg>
      </button>

      <SessionDots sessions={book.sessions} />

      {open && book.sessions.length > 0 ? (
        <div className="mt-[13px] flex flex-col gap-[9px] border-t border-line-soft pt-[11px]">
          {book.sessions.map((session) => (
            <div key={session.sessionId} className="flex items-center gap-[10px]">
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[9px] text-[11.5px] font-bold ${
                  session.covered ? "bg-blue-tint text-blue" : "bg-shell text-tan"
                }`}
              >
                {session.number}
              </div>
              <span
                className={`min-w-0 grow text-[14px] font-semibold ${
                  session.covered ? "text-ink" : "text-tan"
                }`}
              >
                {session.title}
              </span>
              <span className="shrink-0 text-[12.5px] text-tan">{sessionWhen(session)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The dot row itself (#68): at most six per row, however long the book is.
 *
 * A short book still fills the width, the way the board's stretching row does —
 * the columns are `min(6, sessions)`. A twelve-session book is two full rows of
 * six at 390px, each cell ~50px wide and 34px tall, which is what keeps #30's
 * target size instead of the 22px the single row squeezed them to.
 */
export function SessionDots({ sessions }: { sessions: SessionProgress[] }) {
  if (sessions.length === 0) return null;

  return (
    <div className="mt-[12px] grid gap-[6px]" style={columnsFor(sessions.length)}>
      {sessions.map((session) => (
        <div
          key={session.sessionId}
          title={session.title}
          className={`flex h-[34px] items-center justify-center rounded-[11px] border-[1.5px] text-[12.5px] font-bold ${
            DOT_STYLE[dotState(session)]
          }`}
        >
          {session.number}
        </div>
      ))}
    </div>
  );
}

/** The board's three fills: covered, ran before they joined (#28), untouched. */
const DOT_STYLE: Record<ReturnType<typeof dotState>, string> = {
  done: "border-blue bg-blue text-white",
  before: "border-dashed border-stone bg-sand text-tan",
  none: "border-line bg-card text-stone",
};
