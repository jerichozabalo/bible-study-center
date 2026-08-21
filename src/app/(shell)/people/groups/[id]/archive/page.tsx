/**
 * "Archive this BGroup?" — the confirm, and #27's bulk-move offer.
 *
 * Its own screen rather than a sheet on the detail page: archiving is the one
 * thing here that changes where people belong, and it deserves a sentence
 * explaining what survives before Jericho taps it.
 */
import { notFound, redirect } from "next/navigation";

import { BackRow } from "@/components/BackRow";
import { ArchiveForm } from "@/components/groups/ArchiveForm";
import { requireUser } from "@/lib/auth/guard";
import { getGroup, listGroups } from "@/lib/roster/groups";

export const dynamic = "force-dynamic";

export default async function ArchiveGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const group = await getGroup(user.email, id);

  if (!group) notFound();
  // Already archived: there is nothing to confirm.
  if (group.archivedAt) redirect(`/people/groups/${group.id}`);

  const destinations = (await listGroups(user.email))
    .filter((candidate) => candidate.id !== group.id)
    .map((candidate) => ({ id: candidate.id, name: candidate.name }));

  return (
    <section>
      <BackRow href={`/people/groups/${group.id}`} />

      <h2 className="text-[25px]">Archive {group.name}?</h2>
      <p className="mt-2 text-[15px] leading-[1.5] text-slate">
        It stops proposing meetings and cannot be picked when you create one. Nothing is deleted —
        its history stays, and it keeps its place in the Archived list.
      </p>

      <ArchiveForm
        groupId={group.id}
        memberCount={group.memberCount}
        destinations={destinations}
      />
    </section>
  );
}
