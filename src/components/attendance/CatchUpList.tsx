"use client";

/**
 * Who from another BGroup is missing tonight's session (#31) — the sheet's half
 * of catch-up matching, and the way a ride-along gets onto the sheet.
 *
 * The Attendance board predates #31 and draws no such section; the cards below
 * are the board's own person row in its quieter form (no tick ring, no chip),
 * because these people are not on the sheet yet.
 *
 * It renders INSIDE the sheet's `<form>` (issue 17): "Add to tonight" is a
 * submit button carrying the personId as `rideAlong`, so the ticks the leader
 * has already made ride along in the same post and cannot be lost. The name
 * still links through to the person screen, where the Call / Text buttons are —
 * drafting the catch-up invite itself is v1.1.
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
  pending,
}: {
  candidates: CatchUpCandidate[];
  /** The session they are all missing — never null, or there is no list. */
  sessionNumber: number | null;
  sessionTitle: string | null;
  /** The sheet's action is running — hold the add buttons. */
  pending: boolean;
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
        {sessionTitle === null ? "" : ` — ${sessionTitle}`}. Add whoever came along tonight.
      </p>

      <div className="flex flex-col gap-[9px]">
        {candidates.map((candidate) => {
          const joined = catchUpJoinedNote(candidate);

          return (
            <div
              key={candidate.personId}
              className="flex items-center gap-3 rounded-[20px] border-[1.5px] border-line bg-card px-3 py-[12px]"
            >
              <Link
                href={`/people/${candidate.personId}`}
                className="flex min-w-0 grow items-center gap-3 active:opacity-70"
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
              </Link>
              <button
                type="submit"
                name="rideAlong"
                value={candidate.personId}
                disabled={pending}
                className="shrink-0 rounded-[14px] bg-blue px-[14px] py-[10px] text-[13.5px] font-bold text-white active:bg-blue-deep disabled:opacity-60"
              >
                Add to tonight
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
