/**
 * This week's celebrants (bst-v1.1 issue 3) — Home's birthday card.
 *
 * "This week" is the calendar week, **Sunday to Saturday, read in Manila** —
 * the calendar's own week convention (#46), not a rolling seven days, so the
 * card changes over on Sunday morning and answers the same question for the
 * whole week.
 *
 * Three seams that a naive month/day compare gets wrong, and this module does
 * not:
 *
 * 1. **The year boundary.** The last week of December can contain January
 *    days: a birthday on 1 January needs a celebration date in the NEXT year.
 *    The week is built as real dates (UTC arithmetic on calendar days, never
 *    through the server's clock), so the match carries across.
 * 2. **Feb 29.** The named decision: in a common year it is celebrated on
 *    Feb 28; in a leap year it keeps its own day (and does not also match the
 *    28th — the fallback is off whenever the day's year has the 29th).
 * 3. **Age.** Derived from the birthday every time (#9b), and counted on the
 *    day they celebrate: this is the age they turn, not the age they are.
 *
 * Everything here is read-only: a birthday is a fact about a person, and the
 * card is what that fact means this week. Removed people (#24) are out; people
 * who have stepped away (#10) are still people the leader may want to greet.
 */
import { addDays, isCalendarDate, manilaToday, weekdayOf } from "../dates";
import { query } from "../db";

/** One person the card names, with the day and the age they turn. */
export type BirthdayCelebrant = {
  personId: string;
  name: string;
  /** Shown in place of `name` (`display.ts`'s `displayName`). NULL = not set. */
  nickname: string | null;
  /** Their birthday as stored — a full `YYYY-MM-DD` date. */
  birthday: string;
  /** The day this week they celebrate, in the year that week falls in. */
  celebratingOn: string;
  /** The age they turn that day. Derived, never stored (#9b). */
  turns: number;
};

/** The shape the pure derivation reads — what `getBirthdayCelebrants` selects. */
export type BirthdaySource = {
  personId: string;
  name: string;
  nickname: string | null;
  birthday: string;
};

function isLeapYear(date: string): boolean {
  const year = Number(date.slice(0, 4));
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** The Sunday → Saturday week that contains `today`. */
export function weekOf(today: string): { start: string; end: string } {
  const start = addDays(today, -weekdayOf(today));
  return { start, end: addDays(start, 6) };
}

/** Does a day in the week carry this birthday's month and day? */
function celebratesOn(monthDay: string, day: string): boolean {
  const [, month, date] = day.split("-");
  if (`${month}-${date}` === monthDay) return true;

  // The Feb-29 decision: celebrated on Feb 28 in a common year, and only then.
  return monthDay === "02-29" && month === "02" && date === "28" && !isLeapYear(day);
}

/**
 * The week's celebrants, soonest day first, then by name. Pure — the database
 * read lives in `getBirthdayCelebrants` and hands its rows straight here.
 */
export function celebrantsThisWeek(
  people: BirthdaySource[],
  today: string,
): BirthdayCelebrant[] {
  if (!isCalendarDate(today)) return [];

  const { start, end } = weekOf(today);
  const days: string[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);

  const celebrants: BirthdayCelebrant[] = [];
  for (const person of people) {
    if (!isCalendarDate(person.birthday)) continue;

    const [, month, date] = person.birthday.split("-");
    const celebratingOn = days.find((day) => celebratesOn(`${month}-${date}`, day));
    if (celebratingOn === undefined) continue;

    // The age they turn on the day they celebrate. Not `ageOn`: a Feb-29
    // birthday observed on Feb 28 would read 25 — true until the 29th, but
    // the card celebrates the birthday, and that birthday is the 26th.
    const turns = Number(celebratingOn.slice(0, 4)) - Number(person.birthday.slice(0, 4));

    celebrants.push({
      personId: person.personId,
      name: person.name,
      nickname: person.nickname,
      birthday: person.birthday,
      celebratingOn,
      turns,
    });
  }

  return celebrants.sort((left, right) =>
    left.celebratingOn === right.celebratingOn
      ? left.name.toLowerCase().localeCompare(right.name.toLowerCase())
      : left.celebratingOn < right.celebratingOn
        ? -1
        : 1,
  );
}

/**
 * This week's celebrants, read from the roster. One query, then the pure
 * derivation — the week rule lives in exactly one place.
 *
 * `today` is a parameter so a test can stand in a particular week; it defaults
 * to Manila's today (#56).
 */
export async function getBirthdayCelebrants(
  ownerId: string,
  today: string = manilaToday(),
): Promise<BirthdayCelebrant[]> {
  if (!isCalendarDate(today)) return [];

  const rows = await query<{
    person_id: string;
    name: string;
    nickname: string | null;
    birthday: string;
  }>(
    `SELECT p.id AS person_id,
            p.name,
            p.nickname,
            p.birthday::text AS birthday
       FROM people p
      WHERE p.owner_id = $1
        AND p.removed_at IS NULL
        AND p.birthday IS NOT NULL`,
    [ownerId],
  );

  return celebrantsThisWeek(
    rows.map((row) => ({
      personId: row.person_id,
      name: row.name,
      nickname: row.nickname,
      birthday: row.birthday,
    })),
    today,
  );
}
