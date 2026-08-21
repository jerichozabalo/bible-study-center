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
