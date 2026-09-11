"use client";

/**
 * "Before you advance" — `design/GroupDetail.dc.html`'s bottom sheet, and the
 * whole of #18: a silent advance was rejected by name, so moving the group to
 * the next book always shows who it leaves behind first.
 *
 * What the sheet is for (#4/#18/#28):
 *
 * - It lists the members who have not finished the outgoing book, **strictly**
 *   (#5) — one missing session is not finished. Nobody is dropped from it for
 *   having joined late; #28's marker travels with them instead, which is what
 *   keeps the list reading as a plan rather than as a pile of failures.
 * - Advancing is still allowed. The point is that Jericho sees the cost and
 *   says yes to it — those members land on the catch-up path (#31), which issue
 *   7's matching already serves.
 * - "Wait — plan a makeup" is the board's own wording and it only closes the
 *   sheet. The app schedules nothing by itself (#18 rejected auto makeups); the
 *   makeup is a night he creates from the [+] tab.
 *
 * Confirming writes one column, `groups.current_book_id` (#17) — no enrolment
 * (#16), no completion, and no member's progress reset.
 */
import { useActionState, useState } from "react";

import { initialsOf } from "@/lib/roster/display";
import { advanceIntroLine, missingSessionsLine } from "@/lib/insights/display";
import type { MemberProgress } from "@/lib/insights/progress";
import { advanceGroupAction } from "@/lib/roster/actions";

export function AdvanceCheckpoint({
  groupId,
  bookTitle,
  nextBook,
  leftBehind,
}: {
  groupId: string;
  /** The outgoing book's title, as the sheet's sentence names it. */
  bookTitle: string;
  /** Short label, the way the board writes it on the button: "Book 2". */
  nextBook: { id: string; label: string };
  leftBehind: MemberProgress[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(advanceGroupAction, {});

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-[15px] flex h-[54px] w-full items-center justify-center gap-2 rounded-[16px] bg-card text-[16px] font-bold text-blue-deep active:bg-shell"
      >
        Advance to {nextBook.label}
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#143761"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12h14m-6-6 6 6-6 6" />
        </svg>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(15,26,40,0.5)]"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Before you advance"
            onClick={(event) => event.stopPropagation()}
            className="max-h-[85%] w-full max-w-[420px] overflow-y-auto rounded-t-[28px] bg-sand px-[18px] pt-5 pb-[22px] text-ink"
          >
            <div className="mx-auto mb-4 h-[5px] w-11 rounded-[3px] bg-[#D6CEC0]" />
            <h3 className="text-[21px]">Before you advance</h3>
            <p className="mt-[6px] text-[14.5px] leading-[1.45] text-slate">
              {advanceIntroLine(leftBehind.length, bookTitle, nextBook.label)}
            </p>

            {leftBehind.length === 0 ? null : (
              <div className="mt-[15px] flex flex-col gap-[9px]">
                {leftBehind.map((member) => (
                  <div
                    key={member.personId}
                    className="flex items-center gap-[11px] rounded-[18px] border-[1.5px] border-[#E0BE86] bg-card px-[14px] py-[13px]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-amber-well text-[13.5px] font-bold text-amber-ink">
                      {initialsOf(member.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[15.5px] font-bold">{member.name}</div>
                      <div className="mt-[2px] text-[13.5px] text-[#7C4708]">
                        {missingSessionsLine(member)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {state.error ? (
              <p
                role="alert"
                className="mt-4 rounded-[18px] border border-line bg-card px-4 py-3 text-[14.5px] leading-[1.45] text-ink"
              >
                {state.error}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-4 flex h-[56px] w-full items-center justify-center rounded-[17px] border-2 border-blue text-[16px] font-bold text-blue active:bg-shell"
            >
              Wait — plan a makeup
            </button>
            <form action={formAction}>
              <input type="hidden" name="id" value={groupId} />
              <input type="hidden" name="bookId" value={nextBook.id} />
              <button
                type="submit"
                disabled={pending}
                className="mt-[9px] flex h-[56px] w-full items-center justify-center rounded-[17px] bg-blue text-[16px] font-bold text-white active:bg-blue-deep disabled:opacity-60"
              >
                {pending ? "Advancing…" : "Advance anyway"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
