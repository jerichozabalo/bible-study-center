/**
 * One person, as a card — `design/People.dc.html`'s row.
 *
 * Two things the board draws are deliberately not here:
 *
 * - **The progress bar.** Coverage needs held meetings (issue 4) and
 *   completions (issue 9); a bar that is honestly 0% on every row today would
 *   be a worse lie than an absent one, and the space is where it will go.
 * - **The QUIET flag.** #64 counts consecutive missed HELD meetings, and there
 *   are none. The flag slot is used by what IS true now: a contact still owed
 *   (#9/#67), and #10's manual "Stepped away".
 *
 * The avatar's amber variant on the board means quiet, so every avatar here is
 * the blue one until issue 6 can tell them apart.
 */
import Link from "next/link";

import { bookLabel } from "@/lib/curriculum/books";
import { initialsOf } from "@/lib/roster/display";
import type { PersonSummary } from "@/lib/roster/people";

export function PersonRow({ person }: { person: PersonSummary }) {
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
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[17px] bg-blue-tint text-[15.5px] font-bold text-blue">
        {initialsOf(person.name)}
      </div>

      <div className="min-w-0 grow">
        <div className="flex items-center gap-[7px]">
          <span className="truncate text-[16px] font-bold">{person.name}</span>
          {person.contactIncomplete ? <ContactChip /> : null}
          {person.steppedAwayOn ? <SteppedAwayChip /> : null}
        </div>
        <div className="mt-[3px] truncate text-[13.5px] text-slate">{group}</div>
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

/** #10/#66 — "Stepped away", never "Closed". A state, not an alert. */
export function SteppedAwayChip() {
  return (
    <span className="shrink-0 rounded-[8px] bg-shell px-[7px] py-[3px] text-[11px] font-bold tracking-[0.04em] text-tan">
      STEPPED AWAY
    </span>
  );
}
