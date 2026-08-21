/**
 * Editing one of your own books — the same form as adding one.
 *
 * `getOwnBook` is scoped to the leader (#32), so a seeded GLC book gives a 404
 * here rather than an edit screen whose save is refused: CCF's published
 * material is not Jericho's to rewrite (#33).
 */
import { notFound } from "next/navigation";

import { BackRow } from "@/components/BackRow";
import { BookForm } from "@/components/books/BookForm";
import { requireUser } from "@/lib/auth/guard";
import { updateBookAction } from "@/lib/curriculum/actions";
import { getOwnBook } from "@/lib/curriculum/books";

export const dynamic = "force-dynamic";

export default async function EditBookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const book = await getOwnBook(user.email, id);

  if (!book) notFound();

  return (
    <section>
      <BackRow href="/books" title="Edit book" />
      <BookForm
        action={updateBookAction}
        bookId={book.id}
        values={{
          title: book.title,
          sessions: book.sessions.map((session) => ({ id: session.id, title: session.title })),
        }}
        submitLabel="Save changes"
      />
    </section>
  );
}
