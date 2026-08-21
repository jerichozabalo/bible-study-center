/**
 * Dates, said in Manila.
 *
 * Meetings store a local date and time with `Asia/Manila` semantics (#56), and
 * everything else the app prints a date for — archived on, started on — is read
 * in the same room. The zone is named explicitly because the server is not in
 * it: Vercel's functions run in UTC, and the default formatting would move
 * every early-morning timestamp back a day.
 */
const DAY_MONTH = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Manila",
  day: "numeric",
  month: "long",
});

/**
 * The other half of #56: a meeting's date is a `YYYY-MM-DD` string with no zone
 * of its own. The three functions below read and write those strings without
 * ever putting one through the server's clock — parsing "2026-08-19" in UTC and
 * printing it in Manila is how a date silently becomes the next day.
 */
const LONG_DATE = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
});

const MANILA_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "12 May" — the form the artboards use for a date without a year. */
export function formatDayMonth(date: Date): string {
  return DAY_MONTH.format(date);
}

/** Today's local date in Manila, as `YYYY-MM-DD`. */
export function todayInManila(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD, which is the shape the column stores.
  return MANILA_DATE.format(now);
}

/** `YYYY-MM-DD` shifted by whole days, staying a local date throughout. */
export function addDays(date: string, days: number): string {
  const moved = new Date(`${date}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}

/** 0 = Sunday, matching a group's `weekday` and #46's Sunday-first calendar. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** "Wednesday, 19 August" — the note under the new-meeting form's date row. */
export function formatLongDate(date: string): string {
  // Read in UTC because the string IS the local date: shifting it into any
  // other zone would be answering a question nobody asked.
  const parts = LONG_DATE.formatToParts(new Date(`${date}T00:00:00Z`));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";

  return `${part("weekday")}, ${part("day")} ${part("month")}`;
}
