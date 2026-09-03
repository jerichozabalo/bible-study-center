/**
 * "Retire this book?" — the confirm (issue 16).
 *
 * Its own screen rather than a control on the edit form, mirroring where a
 * BGroup's archive confirm lives: retiring can be refused while a group holds
 * the book, and the leader deserves a sentence about what survives — the book
 * leaves the picker, nothing else moves — before tapping it.
 *
 * `getOwnBook` is scoped to the leader (#32), so a seeded GLC book 404s here
 * rather than offering a retire its write would refuse.
 */
import { notFound, redirect } from "next/navigation";

import { BackRow } from "@/components/BackRow";
import { RetireBookForm } from "@/components/books/RetireBookForm";
import { requireUser } from "@/lib/auth/guard";
import { getOwnBook } from "@/lib/curriculum/books";

export const dynamic = "force-dynamic";

export default async function RetireBookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const book = await getOwnBook(user.email, id);

  if (!book) notFound();
  // Already retired: there is nothing to confirm — the way back is on the edit
  // screen and in the "Retired" section of /books.
  if (book.retiredAt) redirect(`/books/${book.id}/edit`);

  return (
    <section>
      <BackRow href={`/books/${book.id}/edit`} />

      <h2 className="text-[25px]">Retire {book.title}?</h2>
      <p className="mt-2 text-[15px] leading-[1.5] text-slate">
        It leaves the book picker and the list of your own books. Nothing is deleted — any BGroup
        already on it keeps it, every session anyone has covered stays, and you can put it back from
        the Retired section on your books.
      </p>

      <RetireBookForm bookId={book.id} />
    </section>
  );
}
