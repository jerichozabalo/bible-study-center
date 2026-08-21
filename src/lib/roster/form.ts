/**
 * Form data in, `GroupInput` out. Kept apart from the server actions so it can
 * be tested without a request, and apart from `groups.ts` so the module does
 * not have to know that HTML exists.
 */
import type { GroupInput } from "./groups";

export function parseGroupForm(formData: FormData): GroupInput {
  return {
    name: text(formData, "name"),
    weekday: integer(formData, "weekday"),
    startTime: text(formData, "startTime"),
    durationMinutes: integer(formData, "durationMinutes"),
    // The picker's "Not chosen yet" option posts an empty string.
    currentBookId: text(formData, "currentBookId") || null,
  };
}

function text(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

/**
 * NaN for anything that is not a number, deliberately. `Number("")` is 0, and
 * 0 is Sunday — a field that never arrived must not read as a valid answer.
 */
function integer(formData: FormData, field: string): number {
  const raw = text(formData, field).trim();
  return raw === "" ? Number.NaN : Number(raw);
}
