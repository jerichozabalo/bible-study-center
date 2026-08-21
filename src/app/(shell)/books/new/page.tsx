/**
 * Add your own book (#22). No artboard draws it — see
 * `components/books/BookForm.tsx` for where its look comes from.
 */
import { BackRow } from "@/components/BackRow";
import { BookForm } from "@/components/books/BookForm";
import { createBookAction } from "@/lib/curriculum/actions";

export const dynamic = "force-dynamic";

export default function NewBookPage() {
  return (
    <section>
      <BackRow href="/books" title="Add your own book" />
      <BookForm
        action={createBookAction}
        values={{ title: "", sessions: [] }}
        submitLabel="Save book"
      />
    </section>
  );
}
