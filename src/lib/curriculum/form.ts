/**
 * Form data in, `CustomBookInput` out. Kept apart from the server actions so it
 * can be tested without a request, and apart from `custom.ts` so the module
 * does not have to know that HTML exists — the same split `roster/form.ts` uses.
 *
 * The editor posts one `sessionId` and one `sessionTitle` per row, paired by
 * position. An existing session carries its id; a row being added posts an
 * empty one.
 */
import type { CustomBookInput, CustomSessionInput } from "./custom";

/** What the book form renders from — on a first paint and on a refusal alike. */
export type BookFormValues = {
  title: string;
  sessions: CustomSessionInput[];
};

export function parseBookForm(formData: FormData): CustomBookInput {
  // A row that is new AND blank is one of the spare rows the form always
  // offers, left untouched. An existing session whose title was emptied is a
  // different thing entirely and has to reach the validator.
  const sessions = rows(formData).filter(
    (session) => session.id !== null || session.title.trim().length > 0,
  );

  return { title: text(formData, "title"), sessions };
}

export function bookFormValuesFrom(formData: FormData): BookFormValues {
  return { title: text(formData, "title"), sessions: rows(formData) };
}

function rows(formData: FormData): CustomSessionInput[] {
  const ids = formData.getAll("sessionId");
  const titles = formData.getAll("sessionTitle");

  return titles.map((title, index) => ({
    id: string(ids[index]) || null,
    title: string(title),
  }));
}

function text(formData: FormData, field: string): string {
  return string(formData.get(field));
}

function string(value: FormDataEntryValue | null | undefined): string {
  return typeof value === "string" ? value : "";
}
