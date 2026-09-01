/**
 * Progress, in words — the lines the Person and GroupDetail boards print under
 * their dot rows, and the three states a dot can be in.
 *
 * Kept pure and apart from `progress.ts` for the reason `roster/display.ts`
 * exists: none of it touches the database, two screens print the same
 * sentences, and the copy is what Jericho actually reads. A derivation test
 * would not notice "3 of 6" quietly becoming "3/6".
 *
 * The wording is the boards' own, with one correction and one addition. The
 * correction: the GroupDetail board writes "Missing Session 3 and 4" and the
 * plural is said properly here. The addition: no board draws someone who
 * joined after a whole book had run, and "joined at Session 7" of a six-session
 * book would be nonsense, so that case says what happened instead.
 */
import { formatCalendarDayMonth } from "../dates";
import type { BookProgress, GroupBookProgress, MemberProgress, SessionProgress } from "./progress";

/** What a dot looks like: filled, dashed (#28), or empty. */
export type DotState = "done" | "before" | "none";

/**
 * "3 of 6 · joined at Session 3, owes 1 and 2" — the Person board's line.
 *
 * Covered wins over everything: a session filled later as a ride-along (#31) is
 * covered, whenever it ran.
 */
export function bookStatusLine(book: BookProgress): string {
  if (book.sessionCount === 0) return "No sessions yet";

  const marker = joinedAtClause(book);

  if (book.coveredCount === 0 && marker === null) return "Not started";

  const count = `${book.coveredCount} of ${book.sessionCount}`;
  if (book.complete) return `${count} · complete`;

  return marker === null ? count : `${count} · ${marker}`;
}

/** The dot itself. Covered is covered, whatever else is true of the session. */
export function dotState(session: SessionProgress): DotState {
  if (session.covered) return "done";
  return session.beforeJoining ? "before" : "none";
}

/** The date beside a session in the opened list — or why there is none. */
export function sessionWhen(session: SessionProgress): string {
  if (session.covered) return session.date === null ? "done" : formatCalendarDayMonth(session.date);
  return session.beforeJoining ? "before they joined" : "not yet";
}

/**
 * "Missing Sessions 1 and 2 — joined at Session 3" — one left-behind member on
 * the advance checkpoint (#18), with #28's marker attached.
 */
export function missingSessionsLine(member: MemberProgress): string {
  const missing = member.missingSessionNumbers;
  const noun = missing.length === 1 ? "Session" : "Sessions";
  const line = missing.length === 0 ? "Nothing missing" : `Missing ${noun} ${listOf(missing)}`;

  if (member.joinedAtSessionNumber === null) return line;
  return `${line} — ${markerFor(member.joinedAtSessionNumber, member.sessionCount)}`;
}

/**
 * "All 6 sessions covered by the group · 4 of 6 members complete" — the line
 * under the current-book card.
 *
 * It is a roll-up of per-person facts and not a group record (#2): the first
 * half is the group's own history of held nights, the second is how many of its
 * members have every session of the book.
 */
export function groupBookLine(progress: GroupBookProgress): string {
  const covered = progress.groupComplete
    ? `All ${progress.sessionCount} sessions covered by the group`
    : `${progress.coveredByGroupCount} of ${progress.sessionCount} sessions covered by the group`;

  if (progress.members.length === 0) return covered;

  return `${covered} · ${progress.completeMemberCount} of ${progress.members.length} members complete`;
}

/**
 * The advance checkpoint's opening sentence (#18) — what advancing costs,
 * before the button that pays it.
 *
 * `nextLabel` is the short form the button uses ("Book 2"), because the sheet
 * says it twice and the full title is already on the card behind it.
 */
export function advanceIntroLine(
  leftBehindCount: number,
  bookTitle: string,
  nextLabel: string,
): string {
  if (leftBehindCount === 0) {
    return `Everyone has finished ${bookTitle}. Advancing moves the group to ${nextLabel}.`;
  }

  const who = leftBehindCount === 1 ? "1 member has" : `${leftBehindCount} members have`;
  return `${who} not finished ${bookTitle}. Advancing moves the group to ${nextLabel} and puts them on the catch-up list.`;
}

/** "joined at Session 3, owes 1 and 2", or nothing to say. */
function joinedAtClause(book: BookProgress): string | null {
  if (book.joinedAtSessionNumber === null) return null;

  const marker = markerFor(book.joinedAtSessionNumber, book.sessionCount);
  const owed = book.sessions
    .filter((session) => session.beforeJoining && !session.covered)
    .map((session) => session.number);

  if (owed.length === 0) return marker;
  // Naming six numbers helps nobody; "all 6" is the same sentence, shorter.
  const owes = owed.length === book.sessionCount ? `all ${book.sessionCount}` : listOf(owed);
  return `${marker}, owes ${owes}`;
}

function markerFor(joinedAtSessionNumber: number, sessionCount: number): string {
  return joinedAtSessionNumber > sessionCount
    ? "joined after this book"
    : `joined at Session ${joinedAtSessionNumber}`;
}

/** "1", "1 and 2", "1, 2 and 5" — the way it is said out loud. */
function listOf(numbers: number[]): string {
  if (numbers.length <= 1) return numbers.join("");
  return `${numbers.slice(0, -1).join(", ")} and ${numbers[numbers.length - 1]}`;
}
