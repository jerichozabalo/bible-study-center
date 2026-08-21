/**
 * Form data in, `GroupInput` out. Kept apart from the server actions so it can
 * be tested without a request, and apart from `groups.ts` so the module does
 * not have to know that HTML exists.
 */
import type { GroupInput } from "./groups";

/** What the group form renders from — on a first paint and on a refusal alike. */
export type GroupFormValues = {
  name: string;
  weekday: number;
  /** `HH:MM` for the time input. */
  startTime: string;
  durationMinutes: number;
  currentBookId: string | null;
};

/**
 * The form's own defaults, and the floor a re-render falls back to.
 *
 * Sunday evening because that is when Jericho's own BGroup meets; ninety
 * minutes because that is the length the boards draw.
 */
export const GROUP_FORM_DEFAULTS: GroupFormValues = {
  name: "",
  weekday: 0,
  startTime: "19:00",
  durationMinutes: 90,
  currentBookId: null,
};

/**
 * What the form should show again after a refusal.
 *
 * Unlike `parseGroupForm`, this never yields NaN or an empty time: those are
 * meaningful to the validator ("this field never arrived") but meaningless to a
 * `<select>`, which would render blank or, worse, silently read NaN as Sunday.
 * A refusal used to return nothing at all, so a blank name cost the leader the
 * day, time, duration and book they had already chosen (QA pass, 2026-08-21).
 */
export function formValuesFrom(formData: FormData): GroupFormValues {
  const weekday = integer(formData, "weekday");
  const durationMinutes = integer(formData, "durationMinutes");
  const startTime = text(formData, "startTime");

  return {
    name: text(formData, "name"),
    weekday: Number.isNaN(weekday) ? GROUP_FORM_DEFAULTS.weekday : weekday,
    startTime: startTime || GROUP_FORM_DEFAULTS.startTime,
    durationMinutes: Number.isNaN(durationMinutes)
      ? GROUP_FORM_DEFAULTS.durationMinutes
      : durationMinutes,
    currentBookId: text(formData, "currentBookId") || null,
  };
}

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
