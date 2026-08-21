/**
 * The People tab, People segment (#62) — `design/People.dc.html`.
 *
 * Three departures from that board, all of them because it predates #62 and
 * the issues around it:
 *
 * - Its "Add a person" CTA is pinned full-width to the bottom of the screen,
 *   where the tab bar now lives. The tab bar wins (#62), so the action moves
 *   into the title row — exactly where the Groups segment already puts "New
 *   BGroup", so the two halves of this tab match.
 * - Its Quiet and Catch-up filter chips are gone for now: #64's quiet list
 *   counts missed HELD meetings and CATCH-UP is issue 7, so both would render
 *   as chips that filter nothing and always read zero.
 * - The search field stays, and searches what the board's placeholder promises
 *   — a name, or the digits of a number.
 */
import Link from "next/link";

import { PersonRow } from "@/components/people/PersonRow";
import { PEOPLE_SEGMENTS, SegmentedControl } from "@/components/SegmentedControl";
import { requireUser } from "@/lib/auth/guard";
import { formatDayMonth } from "@/lib/dates";
import { initialsOf } from "@/lib/roster/display";
import { listPeople, listRemovedPeople } from "@/lib/roster/people";

/** Reads the session cookie and the roster — never prerendered. */
export const dynamic = "force-dynamic";

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const search = (q ?? "").trim();
  const user = await requireUser();
  const [people, removed] = await Promise.all([
    listPeople(user.email, { search }),
    listRemovedPeople(user.email),
  ]);

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-[26px]">People</h2>
        <Link
          href="/people/new"
          className="flex h-11 items-center gap-[6px] rounded-[14px] px-1 text-[15px] font-bold text-blue active:bg-shell"
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
          Add a person
        </Link>
      </div>

      <SegmentedControl segments={PEOPLE_SEGMENTS} current="/people" />

      {/* A GET form, so a search is a URL: it survives the back button and the
          screen stays a server component. */}
      <form
        action="/people"
        className="mt-[11px] flex h-[52px] items-center gap-[10px] rounded-[16px] border-[1.5px] border-line bg-card px-[14px]"
      >
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#8B7B63"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          name="q"
          defaultValue={search}
          aria-label="Search the roster"
          placeholder="Search name or number"
          autoComplete="off"
          className="min-w-0 grow bg-transparent text-[15.5px] text-ink outline-none"
        />
      </form>

      {people.length > 0 ? (
        <div className="mt-[11px] flex items-baseline justify-between">
          <span className="text-[13.5px] font-semibold text-tan">
            {people.length} shown
          </span>
          {search ? (
            <Link href="/people" className="text-[13.5px] font-bold text-blue">
              Clear
            </Link>
          ) : null}
        </div>
      ) : null}

      {people.length === 0 ? (
        search ? (
          <NoMatch />
        ) : (
          <EmptyRoster />
        )
      ) : (
        <div className="mt-[8px] flex flex-col gap-[8px]">
          {people.map((person) => (
            <PersonRow key={person.id} person={person} />
          ))}
        </div>
      )}

      {removed.length > 0 ? (
        <>
          <div className="mt-[26px] mb-[11px] flex items-center gap-[9px]">
            <h3 className="text-[15px] text-tan">Removed</h3>
            <div className="h-px grow bg-line" />
          </div>
          <div className="flex flex-col gap-[9px]">
            {removed.map((person) => (
              <Link
                key={person.id}
                href={`/people/${person.id}`}
                className="flex items-center gap-[11px] rounded-[20px] bg-shell px-4 py-[13px] active:bg-line"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-card text-[13.5px] font-bold text-tan">
                  {initialsOf(person.name)}
                </div>
                <div className="min-w-0 grow">
                  <div className="truncate text-[15px] font-bold text-slate">{person.name}</div>
                  <div className="mt-[2px] text-[13px] text-tan">
                    {person.removedAt ? `removed ${formatDayMonth(person.removedAt)}` : "removed"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

/** The board's own empty result, word for word. */
function NoMatch() {
  return (
    <div className="px-5 py-10 text-center">
      <div className="text-[15.5px] font-bold">Nobody matches that</div>
      <div className="mt-[6px] text-[14px] text-tan">
        Try part of a first name or the last 4 digits.
      </div>
    </div>
  );
}

function EmptyRoster() {
  return (
    <div className="mt-[14px] rounded-[22px] border-[1.5px] border-line bg-card px-5 py-8 text-center">
      <h3 className="text-[19px]">Nobody on the roster yet</h3>
      <p className="mx-auto mt-2 max-w-[280px] text-[14.5px] leading-[1.5] text-slate">
        A name is enough to start. The phone number, the birthday and the rest can wait until you
        have them.
      </p>
      <Link
        href="/people/new"
        className="mt-5 flex h-[54px] w-full items-center justify-center rounded-[17px] bg-blue text-[16px] font-bold text-white active:bg-blue-deep"
      >
        Add a person
      </Link>
    </div>
  );
}
