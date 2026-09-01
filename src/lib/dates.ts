/**
 * Dates, said in Manila.
 *
 * Meetings store a local date and time with `Asia/Manila` semantics (#56), and
 * everything else the app prints a date for — archived on, started on — is read
 * in the same room. The zone is named explicitly because the server is not in
 * it: Vercel's functions run in UTC, and the default formatting would move
 * every early-morning timestamp back a day.
 *
 * Two shapes live here and they are not interchangeable. A `Date` is an
 * instant — `created_at`, `archived_at` — and gets formatted *into* Manila. A
 * calendar day (a birthday, a meeting's date) is a `YYYY-MM-DD` string that has
 * no zone of its own; it travels as `::text` from Postgres to the screen and is
 * never put through the server's clock. Parsing "2026-08-19" in UTC and
 * printing it in Manila is exactly how a date silently becomes the next day.
 */
const DAY_MONTH = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Manila",
  day: "numeric",
  month: "long",
});

/**
 * Read in UTC on purpose: the string being formatted IS the local date, so
 * shifting it into another zone would answer a question nobody asked.
 */
const WEEKDAY_DATE = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** `en-CA` because its short format IS ISO order — the shape the column stores. */
const MANILA_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "12 May" — the form the artboards use for a date without a year. */
export function formatDayMonth(date: Date): string {
  return DAY_MONTH.format(date);
}

/** Whether a string is a real calendar day in the form a date input posts. */
export function isCalendarDate(value: string): boolean {
  if (!CALENDAR_DATE.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1) return false;
  // Day 0 of the next month is the last day of this one — and it handles the
  // leap year without a rule about centuries.
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * "14 March 1988" — how the Person board writes a date with its year.
 *
 * Built by hand rather than with `Intl` so that a malformed value comes back
 * unchanged instead of throwing at the top of a server component.
 */
export function formatLongDate(value: string): string {
  if (!isCalendarDate(value)) return value;

  const [year, month, day] = value.split("-");
  return `${Number(day)} ${MONTH_NAMES[Number(month) - 1]} ${year}`;
}

/**
 * "30 June" — `formatDayMonth`'s shape for a calendar day rather than an
 * instant, which is what a meeting's date is (#56).
 *
 * Built from the string like `formatLongDate`, so nothing here can put it
 * through the server's clock and land on the day before.
 */
export function formatCalendarDayMonth(value: string): string {
  if (!isCalendarDate(value)) return value;

  const [, month, day] = value.split("-");
  return `${Number(day)} ${MONTH_NAMES[Number(month) - 1]}`;
}

/**
 * "Wednesday, 19 August" — the note under the new-meeting form's date row.
 *
 * Distinct from `formatLongDate` above: this one names the weekday and drops
 * the year, because the question that screen answers is "which day am I
 * picking", not "when was this person born". Two names for two sentences.
 */
export function formatWeekdayDate(date: string): string {
  const parts = WEEKDAY_DATE.formatToParts(new Date(`${date}T00:00:00Z`));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";

  return `${part("weekday")}, ${part("day")} ${part("month")}`;
}

/**
 * Today's date in Bulacan, as `YYYY-MM-DD`.
 *
 * Every day the app records — a joined-on default, the date a transfer
 * happened, the date a new meeting opens on — is the day it is in the room,
 * not on Vercel's clock.
 */
export function manilaToday(now: Date = new Date()): string {
  return MANILA_DAY.format(now);
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

/**
 * Age in whole years on a given day, or null when there is no birthday to
 * count from. Derived, never stored (#9b).
 */
export function ageOn(birthday: string, today: string): number | null {
  if (!isCalendarDate(birthday) || !isCalendarDate(today)) return null;

  const [birthYear, birthMonth, birthDay] = birthday.split("-").map(Number);
  const [year, month, day] = today.split("-").map(Number);

  let age = year - birthYear;
  // The birthday has not come round yet this year.
  if (month < birthMonth || (month === birthMonth && day < birthDay)) age -= 1;
  return age;
}
