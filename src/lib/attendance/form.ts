/**
 * Form data in, a sheet out — and the two words the sheet prints about a mark.
 *
 * Kept apart from the server action so it can be tested without a request, and
 * apart from `completions.ts` so the module does not have to know that HTML
 * exists; the same split the roster's and the meetings' forms use. The labels
 * live here too because the sheet is a client component and must not import a
 * module that reaches the database.
 */
import type { Mark, SheetMark } from "./completions";

export type SheetForm = {
  meetingId: string;
  /** Every row the sheet drew, so a save is the whole sheet and not a delta. */
  marks: SheetMark[];
  /** The name of a walk-in being saved (#67), or null on an ordinary save. */
  walkIn: string | null;
};

/** One field per person: `mark:<id>`, empty when they are not ticked. */
const MARK_FIELD = /^mark:(.+)$/;

export function parseSheetForm(formData: FormData): SheetForm {
  const marks: SheetMark[] = [];

  for (const [field, value] of formData.entries()) {
    const match = MARK_FIELD.exec(field);
    if (!match || typeof value !== "string") continue;

    // The module validates the word itself; an empty string is the sheet
    // saying "not ticked", which is a legal mark and not a missing one.
    marks.push({ personId: match[1], mark: value === "" ? null : (value as Mark) });
  }

  const intent = text(formData, "intent");

  return {
    meetingId: text(formData, "meetingId"),
    marks,
    walkIn: intent === "walk-in" ? text(formData, "walkInName").trim() : null,
  };
}

/**
 * The chip under a marked row (`design/Attendance.dc.html`), in the words each
 * of the three states has earned:
 *
 * - a tick on a night with a lesson completed that session (#25);
 * - a tick on a fellowship night credits nothing but is still contact (#26/#65)
 *   — the same promise the new-meeting form's amber well makes;
 * - present only is presence without the lesson (#25).
 */
export function markChipLabel(mark: Mark, sessionNumber: number | null): string {
  if (mark === "present-only") return "Present only";
  return sessionNumber === null
    ? "Here — counts as contact"
    : `Completed Session ${sessionNumber}`;
}

function text(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}
