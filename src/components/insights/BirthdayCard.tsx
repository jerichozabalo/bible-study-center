/**
 * Home's birthday card (bst-v1.1 issue 3) — who to greet this week.
 *
 * Deliberately silent when nobody is celebrating: an empty card would be a
 * permanently-empty box on the screen the leader opens most, and the
 * issue-7 precedent is silence over an empty state.
 *
 * Rows are the same shape as the "Needs you" cards above it — name, one line
 * of situation, tap to open the person — because it is the same kind of thing:
 * someone the leader should think about this week.
 */
import Link from "next/link";

import type { BirthdayCelebrant } from "@/lib/insights/birthdays";
import { formatCalendarDayMonth } from "@/lib/dates";

export function BirthdayCard({ celebrants }: { celebrants: BirthdayCelebrant[] }) {
  if (celebrants.length === 0) return null;

  return (
    <div className="mt-6">
      <div className="mb-[11px] flex items-baseline justify-between">
        <h3 className="text-[18px]">Birthdays this week</h3>
        <span className="text-[13px] font-semibold text-tan">{celebrants.length}</span>
      </div>
      <div className="flex flex-col gap-[10px]">
        {celebrants.map((person) => (
          <Link
            key={person.personId}
            href={`/people/${person.personId}`}
            className="block rounded-[20px] border border-line bg-card px-[15px] py-[14px] active:bg-shell"
          >
            <div className="flex items-baseline justify-between gap-[10px]">
              <span className="min-w-0 truncate text-[15.5px] font-bold">
                {person.name}
              </span>
              <span className="shrink-0 text-[13.5px] font-semibold text-blue">
                {formatCalendarDayMonth(person.celebratingOn)}
              </span>
            </div>
            <div className="mt-[2px] text-[14px] leading-[1.4] text-slate">
              Turns {person.turns} — say happy birthday.
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
