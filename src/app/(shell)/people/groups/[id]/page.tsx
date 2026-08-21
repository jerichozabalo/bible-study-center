/**
 * One BGroup — `design/GroupDetail.dc.html`.
 *
 * What the board draws that is not here yet, and why: the progress dots and the
 * "Advance to Book 2" checkpoint are issue 9 (they need held meetings and
 * completions to mean anything), and the member cards are issue 3. The blue
 * card, the schedule line and the sections around them are the board's.
 *
 * The board's overflow menu is a bottom row of plain controls instead: with two
 * actions on the screen — edit and archive — a kebab hides them for no gain.
 */
import Link from "next/link";
import { notFound } from "next/navigation";

import { BackRow } from "@/components/BackRow";
import { requireUser } from "@/lib/auth/guard";
import { bookLabel } from "@/lib/curriculum/books";
import { formatDayMonth } from "@/lib/dates";
import { getGroup } from "@/lib/roster/groups";
import { formatMembers, formatSchedule } from "@/lib/roster/schedule";

export const dynamic = "force-dynamic";

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const group = await getGroup(user.email, id);

  if (!group) notFound();

  const book =
    group.currentBookTitle === null
      ? null
      : bookLabel({ number: group.currentBookNumber, title: group.currentBookTitle });

  return (
    <section className="pb-4">
      <BackRow href="/people/groups" />

      <h2 className="text-[25px]">{group.name}</h2>
      <div className="mt-1 text-[14px] text-slate">
        {formatSchedule(group)} · {formatMembers(group.memberCount)} · started{" "}
        {formatDayMonth(group.createdAt)}
      </div>

      {group.archivedAt ? (
        <div className="mt-4 rounded-[20px] bg-shell px-4 py-[15px]">
          <div className="text-[15px] font-bold text-slate">
            Archived {formatDayMonth(group.archivedAt)}
          </div>
          <p className="mt-[3px] text-[13.5px] leading-[1.45] text-tan">
            It proposes no meetings and cannot be picked when you create one. Nothing was deleted.
          </p>
        </div>
      ) : null}

      <div className="mt-4 rounded-[22px] bg-blue p-[18px] text-white">
        <div className="text-[10px] font-bold tracking-[0.13em] text-blue-pale">CURRENT BOOK</div>
        <h3 className="mt-[6px] text-[21px] text-white">{book ?? "No book chosen yet"}</h3>
        <div className="mt-[9px] text-[14px] text-blue-soft">
          {book === null
            ? "The group carries the book — pick one and every meeting prefills from it."
            : `${group.currentBookSessionCount} sessions in this book`}
        </div>
        {group.archivedAt ? null : (
          <Link
            href={`/people/groups/${group.id}/edit`}
            className="mt-[15px] flex h-[54px] w-full items-center justify-center rounded-[16px] bg-card text-[16px] font-bold text-blue-deep"
          >
            {book === null ? "Choose a book" : "Change book"}
          </Link>
        )}
      </div>

      <div className="mt-[22px] mb-[11px] flex items-baseline justify-between">
        <h3 className="text-[18px]">Members</h3>
        <span className="text-[13px] font-bold text-tan">{group.memberCount}</span>
      </div>
      <div className="rounded-[20px] border border-line bg-card px-4 py-6 text-center">
        <p className="mx-auto max-w-[250px] text-[14.5px] leading-[1.45] text-slate">
          Adding people to a BGroup arrives with issue 3.
        </p>
      </div>

      {group.archivedAt ? null : (
        <div className="mt-[22px] flex flex-col gap-[9px]">
          <Link
            href={`/people/groups/${group.id}/edit`}
            className="flex h-[54px] w-full items-center justify-center rounded-[17px] border-[1.5px] border-line bg-card text-[15.5px] font-bold text-ink active:bg-shell"
          >
            Edit BGroup
          </Link>
          <Link
            href={`/people/groups/${group.id}/archive`}
            className="flex h-[54px] w-full items-center justify-center rounded-[17px] text-[15.5px] font-bold text-tan active:bg-shell"
          >
            Archive BGroup
          </Link>
        </div>
      )}
    </section>
  );
}
