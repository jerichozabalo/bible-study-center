"use client";

/**
 * Retiring a custom book (issue 16) — the confirm, on its own screen the same
 * way a BGroup's archive confirm is.
 *
 * A client component for `useActionState`: retiring is refused while a BGroup
 * holds the book as its current one, and that sentence — which names the
 * group(s) — has to come back onto the screen the button was pressed on.
 */
import Link from "next/link";
import { useActionState } from "react";

import type { BookFormState } from "@/lib/curriculum/actions";
import { retireBookAction } from "@/lib/curriculum/actions";

export function RetireBookForm({ bookId }: { bookId: string }) {
  const [state, formAction, pending] = useActionState<BookFormState, FormData>(
    retireBookAction,
    {},
  );

  return (
    <form action={formAction} className="pt-2">
      <input type="hidden" name="id" value={bookId} />

      {state.error ? (
        <p
          role="alert"
          className="mb-4 rounded-[18px] border border-line bg-card px-4 py-3 text-[14.5px] leading-[1.45] text-ink"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-[6px] flex h-[58px] w-full items-center justify-center rounded-[18px] bg-blue text-[17px] font-bold text-white active:bg-blue-deep disabled:opacity-60"
      >
        {pending ? "Retiring…" : "Retire this book"}
      </button>
      <Link
        href={`/books/${bookId}/edit`}
        className="mt-[9px] flex h-[54px] w-full items-center justify-center rounded-[17px] text-[15.5px] font-bold text-slate active:bg-shell"
      >
        Cancel
      </Link>
    </form>
  );
}
