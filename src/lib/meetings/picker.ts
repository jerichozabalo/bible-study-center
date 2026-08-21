/**
 * The new-meeting form's group picker (#63).
 *
 * Three cards, ordered by the group's last **HELD** meeting, most recent first
 * — the group you are logging is almost always the one you just met with — and
 * never-met groups last, because they have no recency to rank on. The rest sit
 * behind "See N more". Archived groups are not offered at all (#60).
 *
 * Each card carries two lines and they are not decoration: line one is the
 * schedule and the book, line two is `6 members · last met Aug 17`, which is
 * what stops the recency ordering from looking arbitrary.
 *
 * Everything here is pure, the way `roster/schedule.ts` is: the rows themselves
 * come from `listPickerGroups` in `prefill.ts`. The split is not tidiness — the
 * collapse rule ("a selected group is never hidden") runs in the browser, and a
 * module that reaches for the database cannot be imported there.
 */
import { formatMembers, formatTime, weekdayPlural } from "../roster/schedule";

/** #63: three cards. The rest are behind "See N more". */
export const VISIBLE_GROUPS = 3;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * "last met Aug 17", or "no meetings yet".
 *
 * The date is split rather than parsed into a `Date`: it is a wall-clock date
 * with no zone of its own (#56), and putting it through the server's UTC clock
 * is how a Manila evening becomes the day before.
 */
export function formatLastMet(date: string | null): string {
  if (date === null) return "no meetings yet";
  const [, month, day] = date.split("-");
  return `last met ${MONTHS[Number(month) - 1]} ${Number(day)}`;
}

/** Line one: "Tuesdays 7:00 PM · Book 1". */
export function pickerScheduleLine(group: {
  weekday: number;
  startTime: string;
  currentBookNumber: number | null;
}): string {
  // The short book form, not `bookLabel`'s "Book 1 — One By One": the full
  // title beside the schedule overflows a 390px card, which is the same reason
  // #63 split the meta onto a second line.
  const book = group.currentBookNumber === null ? "No book yet" : `Book ${group.currentBookNumber}`;
  return `${weekdayPlural(group.weekday)} ${formatTime(group.startTime)} · ${book}`;
}

/** Line two: "6 members · last met Aug 17". */
export function pickerMetaLine(memberCount: number, lastHeldDate: string | null): string {
  return `${formatMembers(memberCount)} · ${formatLastMet(lastHeldDate)}`;
}

/**
 * Which cards are on screen. Collapsed that is the first three — except that a
 * selected group is never hidden by collapsing (#63): it takes the last visible
 * slot, so tapping "See less" cannot silently deselect the group you picked.
 */
export function visibleGroups<T extends { id: string }>(
  ordered: T[],
  selectedId: string | null,
  expanded: boolean,
): T[] {
  if (expanded) return ordered;

  const shown = ordered.slice(0, VISIBLE_GROUPS);
  if (selectedId === null || shown.some((group) => group.id === selectedId)) return shown;

  const selected = ordered.find((group) => group.id === selectedId);
  return selected ? [...shown.slice(0, VISIBLE_GROUPS - 1), selected] : shown;
}

/** The expander's label, or null when every group is already on screen. */
export function moreLabel(total: number, expanded: boolean): string | null {
  const hidden = total - VISIBLE_GROUPS;
  if (hidden <= 0) return null;
  return expanded ? "See less" : `See ${hidden} more`;
}
