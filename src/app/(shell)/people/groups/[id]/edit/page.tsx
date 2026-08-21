/**
 * Editing a BGroup — the same form as creating one.
 *
 * Changing the day here changes the group's one recurrence (#48). Moving the
 * future PROPOSED meetings that follow from it is #48b, and belongs to the
 * meetings module (issue 4) — there are no meetings to move yet.
 */
import { notFound } from "next/navigation";

import { BackRow } from "@/components/BackRow";
import { GroupForm } from "@/components/groups/GroupForm";
import { requireUser } from "@/lib/auth/guard";
import { bookLabel, listBooks } from "@/lib/curriculum/books";
import { getGroup } from "@/lib/roster/groups";
import { updateGroupAction } from "@/lib/roster/actions";

export const dynamic = "force-dynamic";

export default async function EditGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const [group, books] = await Promise.all([getGroup(user.email, id), listBooks()]);

  if (!group) notFound();

  return (
    <section>
      <BackRow href={`/people/groups/${group.id}`} title="Edit BGroup" />
      <GroupForm
        action={updateGroupAction}
        groupId={group.id}
        books={books.map((book) => ({
          id: book.id,
          label: bookLabel(book),
          programName: book.programName,
        }))}
        values={{
          name: group.name,
          weekday: group.weekday,
          // The input wants HH:MM; Postgres hands back HH:MM:SS.
          startTime: group.startTime.slice(0, 5),
          durationMinutes: group.durationMinutes,
          currentBookId: group.currentBookId,
        }}
        submitLabel="Save changes"
      />
    </section>
  );
}
