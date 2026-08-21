/**
 * Form data in, `MeetingInput` out. Kept apart from the server action so it can
 * be tested without a request, and apart from `meetings.ts` so the module does
 * not have to know that HTML exists — the same split the roster's form uses.
 */
import type { MeetingInput } from "./meetings";

export function parseMeetingForm(formData: FormData): MeetingInput {
  return {
    groupId: text(formData, "groupId"),
    date: text(formData, "date"),
    // An empty time or duration is not a refusal — it means "whatever the group
    // meets at" (#36). The form only posts these two when the leader taps
    // Change.
    startTime: text(formData, "startTime") || null,
    durationMinutes: optionalInteger(formData, "durationMinutes"),
    // Both empty on a fellowship night (#26).
    bookId: text(formData, "bookId") || null,
    sessionId: text(formData, "sessionId") || null,
    notes: text(formData, "notes").trim() || null,
    // A checkbox posts nothing at all when it is off.
    repeatWeekly: text(formData, "repeatWeekly") !== "",
  };
}

function text(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

function optionalInteger(formData: FormData, field: string): number | null {
  const raw = text(formData, field).trim();
  // NaN rather than null for a value that is present and unreadable: absent
  // means "inherit", a typo means the module should refuse it.
  return raw === "" ? null : Number(raw);
}
