/**
 * Who from another BGroup is missing tonight's session (#31) — the sheet's half
 * of catch-up matching.
 *
 * The Attendance board predates #31 and draws no such section; the cards below
 * are the board's own person row in its quieter form (no tick ring, no chip),
 * because these people are not on the sheet — they are the reason to invite
 * someone to it. Drafting that invite is v1.1, so a name here is a tap through
 * to the person screen, where the Call / Text buttons already are.
 *
 * #28 travels with each name: someone who joined halfway through the book is
 * behind, and the marker is what keeps the list readable instead of accusing.
 */
import Link from "next/link";

import type { CatchUpCandidate } from "@/lib/attendance/catchup";
import { catchUpJoinedNote, guestLabel } from "@/lib/attendance/form";
import { initialsOf } from "@/lib/roster/display";

export function CatchUpList({
  candidates,
  sessionNumber,
  sessionTitle,
}: {
  candidates: CatchUpCandidate[];
  /** The session they are all missing — never null, or there is no list. */
  sessionNumber: number | null;
  sessionTitle: string | null;
}) {
  // Nothing to say is said with nothing: a fellowship night (#26), a BGroup
  // that is the only one on this book, or an evening where everyone is caught
  // up all arrive here.
  if (candidates.length === 0) return null;

  return (
    <section className="mt-[22px]">
      {/* #66 — the state is CATCH-UP, and it names a path rather than a grade. */}
      <h3 className="text-[18px]">Catch-up</h3>
      <p className="mt-[3px] mb-[11px] text-[13.5px] leading-[1.45] text-slate">
        {candidates.length === 1 ? "One person" : `${candidates.length} people`} in your other
        BGroups {candidates.length === 1 ? "has" : "have"} not covered{" "}
        {sessionNumber === null ? "this session" : `Session ${sessionNumber}`}
        {sessionTitle === null ? "" : ` — ${sessionTitle}`}. Tap a name to reach them.
      </p>

      <div className="flex flex-col gap-[9px]">
        {candidates.map((candidate) => {
          const joined = catchUpJoinedNote(candidate);

          return (
            <Link
              key={candidate.personId}
              href={`/people/${candidate.personId}`}
              className="flex items-center gap-3 rounded-[20px] border-[1.5px] border-line bg-card px-3 py-[12px] active:bg-shell"
            >
              <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[16px] bg-blue-tint text-[15px] font-bold text-blue">
                {initialsOf(candidate.name)}
              </span>
              <span className="min-w-0 grow">
                <span className="block text-[15.5px] leading-[1.2] font-bold">
                  {guestLabel(candidate.name, candidate.homeGroupName)}
                </span>
                {joined === null ? null : (
                  <span className="mt-[3px] block text-[13px] leading-[1.4] text-slate">
                    {joined}
                  </span>
                )}
              </span>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#C3B8A5"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0"
                aria-hidden="true"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
