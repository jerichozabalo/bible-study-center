/**
 * One person, as a card — `design/People.dc.html`'s row, and (with `progress`)
 * `design/GroupDetail.dc.html`'s member row.
 *
 * The two boards draw the same card with a different second line: the roster
 * says which BGroup someone is in, and a BGroup's own member list says how far
 * they have got through the book it is on — inside a group, naming the group
 * again says nothing.
 *
 * What the board draws that is still not here: **the QUIET flag.** #64 counts
 * consecutive missed HELD meetings, and that is issue 8. The flag slot carries
 * what IS true now — a contact still owed (#9/#67), #10's manual "Stepped
 * away", and CATCH-UP (#66) for a member the group has left behind.
 *
 * The avatar's amber variant on the board means quiet; here it means behind,
 * which is the board's own group-row usage.
 */
import Link from "next/link";

import { bookLabel } from "@/lib/curriculum/books";
import type { MemberProgress } from "@/lib/insights/progress";
import { initialsOf } from "@/lib/roster/display";
import type { PersonSummary } from "@/lib/roster/people";

export function PersonRow({
  person,
  progress,
}: {
  person: PersonSummary;
  /** Their standing in their BGroup's current book (#17), on that group's screen. */
  progress?: MemberProgress;
}) {
  const group =
    person.homeGroupName === null
      ? "No BGroup yet"
      : [
          person.homeGroupName,
          person.homeGroupBookTitle === null
            ? null
            : bookLabel({
                number: person.homeGroupBookNumber,
                title: person.homeGroupBookTitle,
              }),
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <Link
      href={`/people/${person.id}`}
      className="flex w-full items-center gap-3 rounded-[20px] border border-line bg-card px-[13px] py-3 active:border-blue"
    >
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[17px] text-[15.5px] font-bold ${
          progress?.behind ? "bg-amber-well text-amber-ink" : "bg-blue-tint text-blue"
        }`}
      >
        {initialsOf(person.name)}
      </div>

      <div className="min-w-0 grow">
        <div className="flex items-center gap-[7px]">
          <span className="truncate text-[16px] font-bold">{person.name}</span>
          {person.contactIncomplete ? <ContactChip /> : null}
          {person.steppedAwayOn ? <SteppedAwayChip /> : null}
          {progress?.behind ? <CatchUpChip /> : null}
        </div>
        {progress === undefined ? (
          <div className="mt-[3px] truncate text-[13.5px] text-slate">{group}</div>
        ) : (
          <div className="mt-[6px] flex items-center gap-2">
            <div className="h-[6px] w-[84px] shrink-0 overflow-hidden rounded-[4px] bg-shell">
              <div
                className={`h-[6px] rounded-[4px] ${
                  progress.behind ? "bg-amber-ink" : "bg-blue"
                }`}
                style={{
                  width: `${
                    progress.sessionCount === 0
                      ? 0
                      : Math.round((progress.coveredCount / progress.sessionCount) * 100)
                  }%`,
                }}
              />
            </div>
            <span className="text-[12.5px] font-semibold text-tan">
              {progress.coveredCount} of {progress.sessionCount}
            </span>
          </div>
        )}
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
        <path d="m9 18 6-6-6-6" />
      </svg>
    </Link>
  );
}

/**
 * #9/#67 — the deferral made visible. Amber is the boards' "look here", and
 * this is a to-do the leader picked up knowingly, not an error.
 */
export function ContactChip() {
  return (
    <span className="shrink-0 rounded-[8px] bg-amber-well px-[7px] py-[3px] text-[11px] font-bold tracking-[0.04em] text-amber-ink">
      NO CONTACT YET
    </span>
  );
}

/**
 * #66 — CATCH-UP, never "BEHIND". It marks a member missing something their
 * BGroup has already covered, which is a night they can still ride along to
 * (#31), not a verdict.
 */
export function CatchUpChip() {
  return (
    <span className="shrink-0 rounded-[8px] bg-amber-well px-[7px] py-[3px] text-[11px] font-bold tracking-[0.04em] text-[#7C4708]">
      CATCH-UP
    </span>
  );
}

/** #10/#66 — "Stepped away", never "Closed". A state, not an alert. */
export function SteppedAwayChip() {
  return (
    <span className="shrink-0 rounded-[8px] bg-shell px-[7px] py-[3px] text-[11px] font-bold tracking-[0.04em] text-tan">
      STEPPED AWAY
    </span>
  );
}
