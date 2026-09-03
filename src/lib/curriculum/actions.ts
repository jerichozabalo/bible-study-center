"use server";

/**
 * The curriculum's server actions — the boundary the book screens post to.
 *
 * The same three steps as `roster/actions.ts`: ask who is signed in (#71, and
 * the owner stamp of #32 comes from there), hand the form to the module, and
 * turn a `CurriculumValidationError` into a sentence the form can print.
 * Anything else that throws keeps throwing.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "../auth/guard";
import {
  CurriculumValidationError,
  createBook,
  retireBook,
  unretireBook,
  updateBook,
} from "./custom";
import { type BookFormValues, bookFormValuesFrom, parseBookForm } from "./form";

/** `values` is what the form re-renders from after a refusal (#24 — nothing typed is lost). */
export type BookFormState = { error?: string; values?: BookFormValues };

export async function createBookAction(
  _previous: BookFormState,
  formData: FormData,
): Promise<BookFormState> {
  const user = await requireUser();

  try {
    await createBook(user.email, parseBookForm(formData));
  } catch (thrown) {
    if (thrown instanceof CurriculumValidationError) {
      return { error: thrown.message, values: bookFormValuesFrom(formData) };
    }
    throw thrown;
  }

  revalidateBooks();
  // Outside the try: `redirect` works by throwing, and catching it here would
  // turn a successful save into "something went wrong".
  redirect("/books");
}

export async function updateBookAction(
  _previous: BookFormState,
  formData: FormData,
): Promise<BookFormState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  try {
    await updateBook(user.email, id, parseBookForm(formData));
  } catch (thrown) {
    if (thrown instanceof CurriculumValidationError) {
      return { error: thrown.message, values: bookFormValuesFrom(formData) };
    }
    throw thrown;
  }

  revalidateBooks();
  redirect("/books");
}

/**
 * Retiring a custom book (issue 16) — its own confirm screen, `/books/[id]/retire`,
 * mirroring where a BGroup's archive confirm lives.
 *
 * It carries form state because retiring can be refused — a BGroup that holds
 * the book as its current one is named back on the same screen the button was
 * pressed, the same shape as `archiveGroupAction`.
 */
export async function retireBookAction(
  _previous: BookFormState,
  formData: FormData,
): Promise<BookFormState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  try {
    await retireBook(user.email, id);
  } catch (thrown) {
    if (thrown instanceof CurriculumValidationError) return { error: thrown.message };
    throw thrown;
  }

  revalidateBooks();
  redirect("/books");
}

/**
 * The way back from a retiring (issue 16 — creation was a one-way door). No form
 * state and no confirmation: un-retiring is not destructive, so there is
 * nothing to refuse and nothing to ask — one control, same shape as
 * `restorePersonAction` / `unarchiveGroupAction`.
 */
export async function unretireBookAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  await unretireBook(user.email, id);

  revalidateBooks();
  redirect(`/books/${id}/edit`);
}

/**
 * A book's title and length are drawn on the group screens too (the picker, the
 * card's "N sessions"), so those are stale the moment a book is edited.
 */
function revalidateBooks(): void {
  revalidatePath("/books");
  revalidatePath("/people/groups");
}
