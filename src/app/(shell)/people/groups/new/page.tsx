/**
 * New BGroup. No artboard draws it — see `components/groups/GroupForm.tsx` for
 * where its look comes from.
 */
import { BackRow } from "@/components/BackRow";
import { GroupForm } from "@/components/groups/GroupForm";
import { bookLabel, listBooks } from "@/lib/curriculum/books";
import { createGroupAction } from "@/lib/roster/actions";

export const dynamic = "force-dynamic";

export default async function NewGroupPage() {
  const books = await listBooks();

  return (
    <section>
      <BackRow href="/people/groups" title="New BGroup" />
      <GroupForm
        action={createGroupAction}
        books={books.map((book) => ({
          id: book.id,
          label: bookLabel(book),
          programName: book.programName,
        }))}
        values={{
          name: "",
          weekday: 0,
          startTime: "19:00",
          durationMinutes: 90,
          currentBookId: null,
        }}
        submitLabel="Create BGroup"
      />
    </section>
  );
}
