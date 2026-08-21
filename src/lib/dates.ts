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

/** "12 May" — the form the artboards use for a date without a year. */
export function formatDayMonth(date: Date): string {
  return DAY_MONTH.format(date);
}

/**
 * Calendar days — the roster's birthday, baptized-on and joined-on (#9b).
 *
 * These are days, not instants, and they travel as `YYYY-MM-DD` text from the
 * `date` column to the screen without ever becoming a `Date`. That is the whole
 * point: `new Date("1988-03-14")` is midnight UTC, which is the 13th in any
 * zone west of Greenwich and would print the wrong birthday for half the
 * planet. Postgres is asked for `::text` and nothing here parses it back.
 */
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

/** Whether a string is a real calendar day in the form a date input posts. */
export function isCalendarDate(value: string): boolean {
  if (!CALENDAR_DATE.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1) return false;
  // Day 0 of the next month is the last day of this one — and it handles the
  // leap year without a rule about centuries.
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** "14 March 1988" — how the Person board writes a date with its year. */
export function formatLongDate(value: string): string {
  if (!isCalendarDate(value)) return value;

  const [year, month, day] = value.split("-");
  return `${Number(day)} ${MONTH_NAMES[Number(month) - 1]} ${year}`;
}

const MANILA_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Today's date in Bulacan, as `YYYY-MM-DD`.
 *
 * Every day the roster records — a joined-on default, the date a transfer
 * happened — is the day it is in the room, not on Vercel's clock. `en-CA`
 * because its short format IS ISO order.
 */
export function manilaToday(now: Date = new Date()): string {
  return MANILA_DAY.format(now);
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
