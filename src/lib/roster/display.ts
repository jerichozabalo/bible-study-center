/**
 * A person, in words — the small pure pieces the roster screens print.
 *
 * Kept out of `people.ts` because none of it touches the database, and out of
 * the components because two screens print the same things and would otherwise
 * each grow their own version.
 */
import { formatLongDate } from "../dates";

/**
 * The two closed lists a person's record offers.
 *
 * They live in this module rather than in `people.ts` because the form is a
 * client component and needs them to render its `<select>`s — and `people.ts`
 * reaches the database, which a browser bundle must never import. `people.ts`
 * validates against these same arrays.
 */

/** Free text would make the roster unfilterable. */
export const CIVIL_STATUSES = ["Single", "Married", "Widowed", "Separated"] as const;
export type CivilStatus = (typeof CIVIL_STATUSES)[number];

/** CCF's 4E ladder (#11). Baptism is separate — it is an event, not a stage. */
export const SPIRITUAL_STATUSES = ["Engage", "Edify", "Equip", "Empower"] as const;
export type SpiritualStatus = (typeof SPIRITUAL_STATUSES)[number];

/**
 * What we call them (bst-v1.1 issue 1): the nickname when it is set, the full
 * name otherwise. One helper, because "shown everywhere" is one rule — the
 * roster, the sheet, the reports and the person's own screen must not each
 * grow their own version of it.
 *
 * The full name stays the stored record; a blank nickname is not a name, so it
 * reads as none at all (storage already turns an empty one into NULL).
 */
export function displayName(person: { name: string; nickname: string | null }): string {
  const nickname = (person.nickname ?? "").trim();
  return nickname === "" ? person.name : nickname;
}

/**
 * The avatar square's letters: first name and last name.
 *
 * Honorifics are dropped — the People board draws "Ptr. Ariel Mendoza" as AM,
 * and PM would name the wrong man. A one-word name (#67's walk-in) gets one
 * letter rather than a padded pair.
 */
export function initialsOf(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0 && !part.endsWith("."));

  if (parts.length === 0) return "?";
  const letters = parts.length === 1 ? [parts[0]] : [parts[0], parts[parts.length - 1]];
  return letters.map((part) => part[0].toUpperCase()).join("");
}

/**
 * The baptism chip (#9b), in #66's spelling.
 *
 * "Not yet baptized" is the Person board's own idiom and it is the point: the
 * chip describes where someone is on a road, not a mark against them.
 */
export function baptizedLabel(baptized: boolean, baptizedOn: string | null): string {
  if (!baptized) return "Not yet baptized";
  return baptizedOn === null ? "Baptized" : `Baptized ${formatLongDate(baptizedOn)}`;
}
