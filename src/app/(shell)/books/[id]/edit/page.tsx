/**
 * Editing one of your own books — the same form as adding one.
 *
 * `getOwnBook` is scoped to the leader (#32), so a seeded GLC book gives a 404
 * here rather than an edit screen whose save is refused: CCF's published
 * material is not Jericho's to rewrite (#33).
 */
import Link from "next/link";
import { notFound } from "next/navigation";

import { BackRow } from "@/components/BackRow";
import { BookForm } from "@/components/books/BookForm";
import { requireUser } from "@/lib/auth/guard";
import { unretireBookAction, updateBookAction } from "@/lib/curriculum/actions";
import { getOwnBook } from "@/lib/curriculum/books";
import { formatDayMonth } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function EditBookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const book = await getOwnBook(user.email, id);

  if (!book) notFound();

  return (
    <section>
      <BackRow href="/books" title="Edit book" />

      {book.retiredAt ? (
        <div className="mb-4 rounded-[20px] bg-shell px-4 py-[15px]">
          <div className="text-[15px] font-bold text-slate">
            Retired {formatDayMonth(book.retiredAt)}
          </div>
          <p className="mt-[3px] text-[13.5px] leading-[1.45] text-tan">
            It is out of the book picker and your books list. Nothing was deleted — any BGroup on it
            keeps it, and every session anyone covered is still here.
          </p>
          {/* Issue 16 — the way back, in the panel that says it is gone, the same
              place a removed person's and an archived BGroup's is. No
              confirmation: unlike retiring, this destroys nothing. */}
          <form action={unretireBookAction} className="mt-3">
            <input type="hidden" name="id" value={book.id} />
            <button
              type="submit"
              className="flex h-[50px] w-full items-center justify-center rounded-[16px] bg-card text-[15.5px] font-bold text-blue"
            >
              Put this book back
            </button>
          </form>
        </div>
      ) : null}

      <BookForm
        action={updateBookAction}
        bookId={book.id}
        values={{
          title: book.title,
          sessions: book.sessions.map((session) => ({ id: session.id, title: session.title })),
        }}
        submitLabel="Save changes"
      />

      {book.retiredAt ? null : (
        <Link
          href={`/books/${book.id}/retire`}
          className="mt-[9px] flex h-[54px] w-full items-center justify-center rounded-[17px] text-[15.5px] font-bold text-tan active:bg-shell"
        >
          Retire this book
        </Link>
      )}
    </section>
  );
}
