/**
 * Form data in, a sheet out — and the two words the sheet prints about a mark.
 *
 * Kept apart from the server action so it can be tested without a request, and
 * apart from `completions.ts` so the module does not have to know that HTML
 * exists; the same split the roster's and the meetings' forms use. The labels
 * live here too because the sheet is a client component and must not import a
 * module that reaches the database.
 */
import { formatLongDate } from "../dates";
import type { CatchUpCandidate } from "./catchup";
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
 * A visitor, in #31's own words: "Nico (BGroup Linggo)" — the name plus the
 * BGroup they came from, because on this sheet that is the thing about them
 * that is not obvious. Nothing else marks them: there is no guest entity, and
 * the row is an ordinary row.
 */
export function guestLabel(name: string, homeGroupName: string | null): string {
  return homeGroupName === null ? name : `${name} (${homeGroupName})`;
}

/**
 * #28's joined-at marker under a catch-up candidate — the same sentence the
 * person screen's `CurrentMembership` writes, said about a BGroup that is not
 * the one whose sheet is open.
 *
 * Null when there is no marker to show, which is what an older record without a
 * membership row looks like: silence beats a guess about when they arrived.
 */
export function catchUpJoinedNote(
  candidate: Pick<
    CatchUpCandidate,
    "homeGroupName" | "joinedOn" | "joinedAtBookNumber" | "joinedAtBookTitle"
  >,
): string | null {
  if (candidate.joinedOn === null) return null;

  const opening = `Joined ${candidate.homeGroupName} on ${formatLongDate(candidate.joinedOn)}`;
  if (candidate.joinedAtBookTitle === null) return `${opening}.`;

  // Same shape as `bookLabel`, which cannot be imported here: it lives beside a
  // module that reaches the database, and this file is read by the sheet.
  const book =
    candidate.joinedAtBookNumber === null
      ? candidate.joinedAtBookTitle
      : `Book ${candidate.joinedAtBookNumber} — ${candidate.joinedAtBookTitle}`;
  return `${opening}, while it was on ${book}.`;
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
