/**
 * The People tab, Groups segment (#62) — `design/Groups.dc.html`.
 *
 * Two deliberate departures from that board, both because it predates #62 and
 * issue 3:
 *
 * - It has no tab bar, and its "New BGroup" action sits in the title row. That
 *   still works under the tab bar, so it stays where it was drawn.
 * - Its cards expand in place to show the members and an "Open group" button.
 *   The roster is issue 3, so a card here goes straight to the group instead of
 *   opening an accordion whose contents do not exist yet.
 */
import Link from "next/link";

import { PEOPLE_SEGMENTS, SegmentedControl } from "@/components/SegmentedControl";
import { bookLabel } from "@/lib/curriculum/books";
import { requireUser } from "@/lib/auth/guard";
import { formatDayMonth } from "@/lib/dates";
import { type GroupSummary, listArchivedGroups, listGroups } from "@/lib/roster/groups";
import { formatMembers, formatSchedule } from "@/lib/roster/schedule";

/** Reads the session cookie and the roster — never prerendered. */
export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const user = await requireUser();
  const [groups, archived] = await Promise.all([
    listGroups(user.email),
    listArchivedGroups(user.email),
  ]);

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-[26px]">People</h2>
        <Link
          href="/people/groups/new"
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
          New BGroup
        </Link>
      </div>

      <SegmentedControl segments={PEOPLE_SEGMENTS} current="/people/groups" />

      {groups.length === 0 ? (
        <EmptyGroups />
      ) : (
        <div className="mt-[14px] flex flex-col gap-[11px]">
          {groups.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      )}

      {archived.length > 0 ? (
        <>
          <div className="mt-[26px] mb-[11px] flex items-center gap-[9px]">
            <h3 className="text-[15px] text-tan">Archived</h3>
            <div className="h-px grow bg-line" />
          </div>
          <div className="flex flex-col gap-[9px]">
            {archived.map((group) => (
              <ArchivedCard key={group.id} group={group} />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

function GroupCard({ group }: { group: GroupSummary }) {
  return (
    <Link
      href={`/people/groups/${group.id}`}
      className="block rounded-[22px] border-[1.5px] border-line bg-card p-4 active:border-blue"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 grow">
          <div className="font-display text-[18px] font-bold tracking-[-0.02em]">{group.name}</div>
          <div className="mt-[3px] text-[13.5px] text-slate">{formatSchedule(group)}</div>
        </div>
        <span className="shrink-0 rounded-[9px] bg-shell px-[9px] py-[5px] text-[12px] font-bold text-tan">
          {formatMembers(group.memberCount)}
        </span>
      </div>

      {/* The board's inset panel. It draws progress dots there too — those are
          coverage, which needs held meetings (issue 4) and completions (issue
          9), so the panel carries the book and its length until then rather
          than a row of dots that would all be honest zeroes today. */}
      <div className="mt-[14px] rounded-[16px] bg-[#FBF9F5] px-[13px] py-3">
        <div className="flex items-baseline justify-between gap-[10px]">
          <span className="min-w-0 text-[14.5px] font-bold">
            {group.currentBookTitle === null
              ? "No book chosen yet"
              : bookLabel({ number: group.currentBookNumber, title: group.currentBookTitle })}
          </span>
          {group.currentBookSessionCount > 0 ? (
            <span className="shrink-0 text-[12.5px] font-bold text-tan">
              {group.currentBookSessionCount} sessions
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function ArchivedCard({ group }: { group: GroupSummary }) {
  const book =
    group.currentBookTitle === null
      ? null
      : bookLabel({ number: group.currentBookNumber, title: group.currentBookTitle });

  return (
    <Link
      href={`/people/groups/${group.id}`}
      className="block rounded-[20px] bg-shell px-4 py-[15px] active:bg-line"
    >
      <div className="flex items-center gap-[11px]">
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#8B7B63"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="5" rx="2" />
          <path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" />
        </svg>
        <div className="min-w-0 grow">
          <div className="text-[15px] font-bold text-slate">{group.name}</div>
          <div className="mt-[2px] text-[13px] text-tan">
            {[book, group.archivedAt ? `archived ${formatDayMonth(group.archivedAt)}` : null]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
      </div>
    </Link>
  );
}

function EmptyGroups() {
  return (
    <div className="mt-[14px] rounded-[22px] border-[1.5px] border-line bg-card px-5 py-8 text-center">
      <h3 className="text-[19px]">No BGroups yet</h3>
      <p className="mx-auto mt-2 max-w-[280px] text-[14.5px] leading-[1.5] text-slate">
        A BGroup is a name, the night it meets, and the book you are on. Everything else — the
        meetings, the roster, who is behind — hangs off that.
      </p>
      <Link
        href="/people/groups/new"
        className="mt-5 flex h-[54px] w-full items-center justify-center rounded-[17px] bg-blue text-[16px] font-bold text-white active:bg-blue-deep"
      >
        New BGroup
      </Link>
    </div>
  );
}
