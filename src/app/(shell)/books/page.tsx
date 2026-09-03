/**
 * Your own books (#22) — the books Jericho wrote himself, and the only place
 * they can be edited.
 *
 * No artboard covers this surface. It follows the Groups list it is reached
 * from: a title row with the create action beside it, cards with a hairline
 * border, and an empty state that explains what the thing is before offering
 * the button.
 *
 * The GLC books are deliberately not listed here. They are CCF's published
 * material, nothing in v1 can change them, and a list that mixed the two would
 * be offering an Edit that eight of its rows refuse.
 *
 * A retired book (issue 16) drops out of the main list and reappears in the
 * "Retired" section at the bottom — the same shape as the "Removed" section on
 * `/people`.
 */
import Link from "next/link";

import { BackRow } from "@/components/BackRow";
import { requireUser } from "@/lib/auth/guard";
import { type BookSummary, listOwnBooks, listRetiredBooks } from "@/lib/curriculum/books";
import { formatDayMonth } from "@/lib/dates";

/** Reads the session cookie and the curriculum — never prerendered. */
export const dynamic = "force-dynamic";

export default async function BooksPage() {
  const user = await requireUser();
  const [books, retired] = await Promise.all([
    listOwnBooks(user.email),
    listRetiredBooks(user.email),
  ]);

  return (
    <section>
      <BackRow href="/people/groups" title="Your own books" />

      {books.length === 0 ? (
        <EmptyBooks />
      ) : (
        <>
          <div className="mt-[6px] flex flex-col gap-[11px]">
            {books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
          <Link
            href="/books/new"
            className="mt-[14px] flex h-[54px] w-full items-center justify-center gap-[6px] rounded-[17px] border-[1.5px] border-dashed border-line text-[16px] font-bold text-blue active:bg-shell"
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
            Add your own book
          </Link>
        </>
      )}

      {retired.length > 0 ? (
        <>
          <div className="mt-[26px] mb-[11px] flex items-center gap-[9px]">
            <h3 className="text-[15px] text-tan">Retired</h3>
            <div className="h-px grow bg-line" />
          </div>
          <div className="flex flex-col gap-[9px]">
            {retired.map((book) => (
              <Link
                key={book.id}
                href={`/books/${book.id}/edit`}
                className="flex items-center gap-[11px] rounded-[20px] bg-shell px-4 py-[13px] active:bg-line"
              >
                <div className="min-w-0 grow">
                  <div className="truncate text-[15px] font-bold text-slate">{book.title}</div>
                  <div className="mt-[2px] text-[13px] text-tan">
                    {book.retiredAt ? `retired ${formatDayMonth(book.retiredAt)}` : "retired"}
                  </div>
                </div>
                <span className="shrink-0 text-[13px] font-bold text-blue">Put back</span>
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

function BookCard({ book }: { book: BookSummary }) {
  return (
    <Link
      href={`/books/${book.id}/edit`}
      className="block rounded-[22px] border-[1.5px] border-line bg-card p-4 active:border-blue"
    >
      <div className="flex items-baseline justify-between gap-[10px]">
        {/* No "Book n" prefix: a book of Jericho's own has no published number
            (#33), which is exactly what `bookLabel` renders. */}
        <span className="min-w-0 font-display text-[18px] font-bold tracking-[-0.02em]">
          {book.title}
        </span>
        <span className="shrink-0 text-[12.5px] font-bold text-tan">
          {book.sessionCount === 1 ? "1 session" : `${book.sessionCount} sessions`}
        </span>
      </div>
      <div className="mt-[3px] text-[13.5px] text-slate">Yours · no program</div>
    </Link>
  );
}

function EmptyBooks() {
  return (
    <div className="mt-[6px] rounded-[22px] border-[1.5px] border-line bg-card px-5 py-8 text-center">
      <h3 className="text-[19px]">No books of your own yet</h3>
      <p className="mx-auto mt-2 max-w-[280px] text-[14.5px] leading-[1.5] text-slate">
        The eight GLC books are already here. Add your own when you are teaching something else —
        it works the same way: a BGroup can carry it, and every session is tracked.
      </p>
      <Link
        href="/books/new"
        className="mt-5 flex h-[54px] w-full items-center justify-center rounded-[17px] bg-blue text-[16px] font-bold text-white active:bg-blue-deep"
      >
        Add your own book
      </Link>
    </div>
  );
}
