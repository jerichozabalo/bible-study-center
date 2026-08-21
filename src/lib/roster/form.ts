/**
 * Form data in, `GroupInput` out. Kept apart from the server actions so it can
 * be tested without a request, and apart from `groups.ts` so the module does
 * not have to know that HTML exists.
 */
import { manilaToday } from "../dates";
import type { GroupInput } from "./groups";
import type { PersonInput } from "./people";

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

/** What the person form renders from — on a first paint and on a refusal alike. */
export type PersonFormValues = {
  name: string;
  phone: string;
  email: string;
  /** "" = no BGroup yet. Never null: a `<select>` cannot render one. */
  homeGroupId: string;
  joinedOn: string;
  birthday: string;
  address: string;
  civilStatus: string;
  spiritualStatus: string;
  baptized: boolean;
  baptizedOn: string;
  invitedBy: string;
  notes: string;
};

/**
 * A blank person. A function rather than a constant because one field is not
 * blank: a new record joined today, and "today" is a question with a different
 * answer tomorrow — and in Manila, not wherever the server stands (#56).
 */
export function personFormDefaults(): PersonFormValues {
  return {
    name: "",
    phone: "",
    email: "",
    homeGroupId: "",
    joinedOn: manilaToday(),
    birthday: "",
    address: "",
    civilStatus: "",
    spiritualStatus: "",
    baptized: false,
    baptizedOn: "",
    invitedBy: "",
    notes: "",
  };
}

/**
 * What the person form should show again after a refusal — everything that was
 * typed, exactly as typed. Thirteen fields is far too many to ask anyone to
 * re-enter because a phone number was four digits long.
 */
export function personFormValuesFrom(formData: FormData): PersonFormValues {
  return {
    name: text(formData, "name"),
    phone: text(formData, "phone"),
    email: text(formData, "email"),
    homeGroupId: text(formData, "homeGroupId"),
    joinedOn: text(formData, "joinedOn"),
    birthday: text(formData, "birthday"),
    address: text(formData, "address"),
    civilStatus: text(formData, "civilStatus"),
    spiritualStatus: text(formData, "spiritualStatus"),
    baptized: checked(formData, "baptized"),
    baptizedOn: text(formData, "baptizedOn"),
    invitedBy: text(formData, "invitedBy"),
    notes: text(formData, "notes"),
  };
}

/**
 * Form data in, `PersonInput` out. Empty strings become null here so the module
 * never has to wonder whether "" means "cleared" or "never asked" — for this
 * form they are the same thing, and #67's walk-in posts a name and twelve of
 * them.
 */
export function parsePersonForm(formData: FormData): PersonInput {
  return {
    name: text(formData, "name"),
    phone: optional(formData, "phone"),
    email: optional(formData, "email"),
    homeGroupId: optional(formData, "homeGroupId"),
    joinedOn: optional(formData, "joinedOn"),
    birthday: optional(formData, "birthday"),
    address: optional(formData, "address"),
    civilStatus: optional(formData, "civilStatus"),
    spiritualStatus: optional(formData, "spiritualStatus"),
    baptized: checked(formData, "baptized"),
    baptizedOn: optional(formData, "baptizedOn"),
    invitedBy: optional(formData, "invitedBy"),
    notes: optional(formData, "notes"),
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

function optional(formData: FormData, field: string): string | null {
  return text(formData, field).trim() || null;
}

/** An unticked checkbox posts nothing at all — that is the whole encoding. */
function checked(formData: FormData, field: string): boolean {
  return formData.get(field) !== null;
}
