/**
 * The roster — Person CRUD, in the same shape as `groups.ts`.
 *
 * Four rules live here rather than on any screen, because every screen has to
 * come through this module:
 *
 * 1. **A name is enough (#9/#67).** #9 wants a phone or an email; #67 defers
 *    that requirement for the walk-in captured mid-meeting, and the person
 *    stays *flagged incomplete* until a detail lands. `contactIncomplete` is
 *    derived, so the flag clears itself the moment someone types a number.
 * 2. **One home group at a time (#15), and a transfer is a move, not a
 *    rewrite (#27).** The group changes, the marker closes, a new one opens,
 *    and nothing the person has covered is touched.
 * 3. **A joined-at marker per membership (#28)** — the day, and the book the
 *    group was on. A mid-book joiner is genuinely behind, and this is what
 *    later makes that readable instead of merely true.
 * 4. **Nothing is erased (#24).** Every correction tombstones the row it
 *    replaced, and removal is a date with a way back.
 *
 * Dates that are days — birthday, baptized on, joined on — are `YYYY-MM-DD`
 * text from the column to the screen and never become a `Date`; see
 * `lib/dates.ts` for what that avoids.
 */
import { type TransactionClient, query, transaction } from "../db";
import { ageOn, isCalendarDate, manilaToday } from "../dates";
import {
  CIVIL_STATUSES,
  type CivilStatus,
  SPIRITUAL_STATUSES,
  type SpiritualStatus,
} from "./display";
import { RosterValidationError } from "./groups";
import { type Membership, listMemberships, moveMembership, openMembership } from "./memberships";

export type { CivilStatus, Membership, SpiritualStatus };

/**
 * Everything but the name is optional, and that is #67 in the type system: the
 * walk-in path calls `createPerson(owner, { name })` and gets a saved person.
 *
 * On an update a field left out is a field **cleared**, not a field kept. The
 * form posts every input on every save, so "absent" can only mean the leader
 * emptied it — keeping the old value there would silently undo a deletion.
 */
export type PersonInput = {
  name: string;
  phone?: string | null;
  email?: string | null;
  homeGroupId?: string | null;
  /** `YYYY-MM-DD`. Defaults to today in Manila. */
  joinedOn?: string | null;
  birthday?: string | null;
  address?: string | null;
  /** Validated against `CIVIL_STATUSES`; a plain string because a form posts one. */
  civilStatus?: string | null;
  /** Validated against `SPIRITUAL_STATUSES` (#11). */
  spiritualStatus?: string | null;
  baptized?: boolean;
  baptizedOn?: string | null;
  invitedBy?: string | null;
  notes?: string | null;
};

export type PersonSummary = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  homeGroupId: string | null;
  homeGroupName: string | null;
  /** The book that BGroup is on (#17) — the roster card's second line. */
  homeGroupBookNumber: number | null;
  homeGroupBookTitle: string | null;
  /** #9/#67 — saved without a phone or an email, and flagged until one lands. */
  contactIncomplete: boolean;
  /** #10/#66 — the manual override. NULL means they are still on the list. */
  steppedAwayOn: string | null;
  /** #24 — removed from the roster, never erased. */
  removedAt: Date | null;
  createdAt: Date;
};

export type PersonDetail = PersonSummary & {
  joinedOn: string;
  birthday: string | null;
  /** Derived from the birthday every time it is read, never stored (#9b). */
  age: number | null;
  address: string | null;
  civilStatus: CivilStatus | null;
  spiritualStatus: SpiritualStatus | null;
  baptized: boolean;
  baptizedOn: string | null;
  invitedBy: string | null;
  notes: string | null;
  /** Newest first. */
  memberships: Membership[];
};

/** What a correction replaced (#24). `previous` is the whole row as it stood. */
export type PersonCorrection = {
  id: string;
  reason: string;
  previous: Record<string, unknown>;
  correctedAt: Date;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Deliberately loose. The job is to catch "nena at gmail", not to adjudicate
// what an address may contain.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SELECT_PERSON = `
  SELECT p.id,
         p.name,
         p.phone,
         p.email,
         p.home_group_id,
         g.name AS home_group_name,
         b.number AS home_group_book_number,
         b.title AS home_group_book_title,
         p.joined_on::text AS joined_on,
         p.birthday::text AS birthday,
         p.address,
         p.civil_status,
         p.spiritual_status,
         p.baptized,
         p.baptized_on::text AS baptized_on,
         p.invited_by,
         p.notes,
         p.stepped_away_on::text AS stepped_away_on,
         p.removed_at,
         p.created_at
    FROM people p
    LEFT JOIN groups g ON g.id = p.home_group_id
    LEFT JOIN books b ON b.id = g.current_book_id
`;

/**
 * The roster, alphabetically, ignoring case — "ben cruz" sits with the Bs.
 *
 * `search` matches part of a name or the digits of a number, which is what the
 * People board's field promises ("Search name or number"). Punctuation is
 * stripped from both sides, so 555-0184 finds 0917 555 0184.
 */
export async function listPeople(
  ownerId: string,
  options: { search?: string } = {},
): Promise<PersonSummary[]> {
  const search = (options.search ?? "").trim();
  const digits = search.replace(/\D/g, "");

  const rows = await query<PersonRow>(
    `${SELECT_PERSON}
      WHERE p.owner_id = $1
        AND p.removed_at IS NULL
        AND ($2 = ''
             OR p.name ILIKE '%' || $2 || '%'
             OR ($3 <> '' AND regexp_replace(coalesce(p.phone, ''), '[^0-9]', '', 'g')
                              LIKE '%' || $3 || '%'))
      ORDER BY lower(p.name) ASC`,
    [ownerId, search, digits],
  );
  return rows.map(toSummary);
}

/** Removed from the roster (#24) — kept, listed under it, and restorable. */
export async function listRemovedPeople(ownerId: string): Promise<PersonSummary[]> {
  const rows = await query<PersonRow>(
    `${SELECT_PERSON} WHERE p.owner_id = $1 AND p.removed_at IS NOT NULL
      ORDER BY p.removed_at DESC`,
    [ownerId],
  );
  return rows.map(toSummary);
}

/** Everyone whose home group this is, for the group's Members section. */
export async function listGroupMembers(
  ownerId: string,
  groupId: string,
): Promise<PersonSummary[]> {
  if (!UUID_PATTERN.test(groupId)) return [];

  const rows = await query<PersonRow>(
    `${SELECT_PERSON}
      WHERE p.owner_id = $1 AND p.home_group_id = $2 AND p.removed_at IS NULL
      ORDER BY lower(p.name) ASC`,
    [ownerId, groupId],
  );
  return rows.map(toSummary);
}

export async function getPerson(ownerId: string, id: string): Promise<PersonDetail | null> {
  if (!UUID_PATTERN.test(id)) return null;

  const rows = await query<PersonRow>(`${SELECT_PERSON} WHERE p.owner_id = $1 AND p.id = $2`, [
    ownerId,
    id,
  ]);
  if (!rows[0]) return null;

  return { ...toDetail(rows[0]), memberships: await listMemberships(id) };
}

export async function createPerson(ownerId: string, input: PersonInput): Promise<string> {
  const clean = await validate(ownerId, input, null);

  return transaction(async (tx) => {
    const rows = await tx.query<{ id: string }>(
      `INSERT INTO people (owner_id, name, phone, email, home_group_id, joined_on, birthday,
                           address, civil_status, spiritual_status, baptized, baptized_on,
                           invited_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id`,
      [
        ownerId,
        clean.name,
        clean.phone,
        clean.email,
        clean.homeGroupId,
        clean.joinedOn,
        clean.birthday,
        clean.address,
        clean.civilStatus,
        clean.spiritualStatus,
        clean.baptized,
        clean.baptizedOn,
        clean.invitedBy,
        clean.notes,
      ],
    );

    const id = rows[0].id;
    if (clean.homeGroupId !== null) {
      // The marker starts the day they joined, not the day the record was
      // typed: a person entered a week late still joined when they joined.
      await openMembership(tx, ownerId, id, clean.homeGroupId, clean.joinedOn);
    }
    return id;
  });
}

/**
 * Save a correction (#24) — and move them, if the home group changed (#27).
 *
 * The whole record is expected; see `PersonInput` on why an absent field is a
 * cleared one.
 */
export async function updatePerson(
  ownerId: string,
  id: string,
  input: PersonInput,
): Promise<void> {
  const current = await getPerson(ownerId, id);
  if (!current) throw new RosterValidationError("That person is no longer on the roster.");

  const clean = await validate(ownerId, input, current);

  await transaction(async (tx) => {
    await tombstone(tx, ownerId, id, "edit");

    await tx.query(
      `UPDATE people
          SET name = $3,
              phone = $4,
              email = $5,
              home_group_id = $6,
              joined_on = $7,
              birthday = $8,
              address = $9,
              civil_status = $10,
              spiritual_status = $11,
              baptized = $12,
              baptized_on = $13,
              invited_by = $14,
              notes = $15,
              updated_at = now()
        WHERE owner_id = $1 AND id = $2`,
      [
        ownerId,
        id,
        clean.name,
        clean.phone,
        clean.email,
        clean.homeGroupId,
        clean.joinedOn,
        clean.birthday,
        clean.address,
        clean.civilStatus,
        clean.spiritualStatus,
        clean.baptized,
        clean.baptizedOn,
        clean.invitedBy,
        clean.notes,
      ],
    );

    if (clean.homeGroupId !== current.homeGroupId) {
      await moveMembership(tx, ownerId, id, clean.homeGroupId);
    }
  });
}

/**
 * #10/#66 — the manual "Stepped away" override, and the way back from it.
 *
 * Separate from `updatePerson` because it is not a correction to the record: it
 * is a pastoral fact about today, reachable in one tap from the person's
 * screen. It still tombstones — the date they stepped away is history the
 * moment it is undone.
 */
export async function setSteppedAway(
  ownerId: string,
  id: string,
  steppedAway: boolean,
): Promise<void> {
  await transaction(async (tx) => {
    await tombstone(tx, ownerId, id, "stepped-away");
    await tx.query(
      `UPDATE people SET stepped_away_on = $3, updated_at = now()
        WHERE owner_id = $1 AND id = $2`,
      [ownerId, id, steppedAway ? manilaToday() : null],
    );
  });
}

/** #24 — off the roster, still in the record. */
export async function removePerson(ownerId: string, id: string): Promise<void> {
  await transaction(async (tx) => {
    await tombstone(tx, ownerId, id, "removed");
    await tx.query(
      `UPDATE people SET removed_at = now(), updated_at = now()
        WHERE owner_id = $1 AND id = $2 AND removed_at IS NULL`,
      [ownerId, id],
    );
  });
}

export async function restorePerson(ownerId: string, id: string): Promise<void> {
  await transaction(async (tx) => {
    await tombstone(tx, ownerId, id, "restored");
    await tx.query(
      `UPDATE people SET removed_at = NULL, updated_at = now()
        WHERE owner_id = $1 AND id = $2`,
      [ownerId, id],
    );
  });
}

/**
 * What this person's record used to say (#24), newest last.
 *
 * Nothing renders this yet — the screens show the record as it stands. It is
 * the readable end of the tombstone, and the reason a correction can be proved
 * to keep what it replaced.
 */
export async function listPersonCorrections(
  ownerId: string,
  personId: string,
): Promise<PersonCorrection[]> {
  if (!UUID_PATTERN.test(personId)) return [];

  const rows = await query<{
    id: string;
    reason: string;
    previous: Record<string, unknown>;
    corrected_at: Date;
  }>(
    `SELECT id, reason, previous, corrected_at
       FROM person_corrections
      WHERE owner_id = $1 AND person_id = $2
      ORDER BY corrected_at ASC, id ASC`,
    [ownerId, personId],
  );

  return rows.map((row) => ({
    id: row.id,
    reason: row.reason,
    previous: row.previous,
    correctedAt: row.corrected_at,
  }));
}

/** The row as it stands now, kept before it is replaced (#24). */
async function tombstone(
  tx: TransactionClient,
  ownerId: string,
  personId: string,
  reason: string,
): Promise<void> {
  await tx.query(
    `INSERT INTO person_corrections (owner_id, person_id, reason, previous)
     SELECT p.owner_id, p.id, $3, to_jsonb(p) FROM people p
      WHERE p.owner_id = $1 AND p.id = $2`,
    [ownerId, personId, reason],
  );
}

type PersonRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  home_group_id: string | null;
  home_group_name: string | null;
  home_group_book_number: number | null;
  home_group_book_title: string | null;
  joined_on: string;
  birthday: string | null;
  address: string | null;
  civil_status: CivilStatus | null;
  spiritual_status: SpiritualStatus | null;
  baptized: boolean;
  baptized_on: string | null;
  invited_by: string | null;
  notes: string | null;
  stepped_away_on: string | null;
  removed_at: Date | null;
  created_at: Date;
};

function toSummary(row: PersonRow): PersonSummary {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    homeGroupId: row.home_group_id,
    homeGroupName: row.home_group_name,
    homeGroupBookNumber: row.home_group_book_number,
    homeGroupBookTitle: row.home_group_book_title,
    // #9/#67 — derived, so it clears itself the moment a detail lands.
    contactIncomplete: row.phone === null && row.email === null,
    steppedAwayOn: row.stepped_away_on,
    removedAt: row.removed_at,
    createdAt: row.created_at,
  };
}

function toDetail(row: PersonRow): Omit<PersonDetail, "memberships"> {
  return {
    ...toSummary(row),
    joinedOn: row.joined_on,
    birthday: row.birthday,
    age: row.birthday === null ? null : ageOn(row.birthday, manilaToday()),
    address: row.address,
    civilStatus: row.civil_status,
    spiritualStatus: row.spiritual_status,
    baptized: row.baptized,
    baptizedOn: row.baptized_on,
    invitedBy: row.invited_by,
    notes: row.notes,
  };
}

type CleanPerson = {
  name: string;
  phone: string | null;
  email: string | null;
  homeGroupId: string | null;
  joinedOn: string;
  birthday: string | null;
  address: string | null;
  civilStatus: CivilStatus | null;
  spiritualStatus: SpiritualStatus | null;
  baptized: boolean;
  baptizedOn: string | null;
  invitedBy: string | null;
  notes: string | null;
};

async function validate(
  ownerId: string,
  input: PersonInput,
  current: PersonDetail | null,
): Promise<CleanPerson> {
  const name = (input.name ?? "").trim();
  if (name.length === 0) throw new RosterValidationError("A person needs a name.");

  const phone = trimmed(input.phone);
  if (phone !== null && phone.replace(/\D/g, "").length < 7) {
    throw new RosterValidationError("That phone number is too short to call.");
  }

  const email = trimmed(input.email);
  if (email !== null && !EMAIL_PATTERN.test(email)) {
    throw new RosterValidationError("That email address does not look right.");
  }

  // #9's phone-or-email is NOT checked here — #67 defers it, and
  // `contactIncomplete` is what remembers that it is still owed.

  const today = manilaToday();
  const birthday = day(input.birthday, "Check the birthday — pick it from the calendar.");
  if (birthday !== null && birthday > today) {
    throw new RosterValidationError("A birthday cannot be in the future.");
  }

  const joinedOn =
    day(input.joinedOn, "Check the joined date — pick it from the calendar.") ?? today;

  const baptizedOn = day(input.baptizedOn, "Check the baptism date — pick it from the calendar.");
  if (baptizedOn !== null && baptizedOn > today) {
    throw new RosterValidationError("A baptism date cannot be in the future.");
  }
  // A date is the stronger statement: someone who typed one and did not tick
  // the box is baptized. Un-ticking AND clearing the date is how it is undone.
  const baptized = (input.baptized ?? false) || baptizedOn !== null;

  const civilStatus = oneOf(
    input.civilStatus,
    CIVIL_STATUSES,
    "Pick a civil status from the list.",
  );
  const spiritualStatus = oneOf(
    input.spiritualStatus,
    SPIRITUAL_STATUSES,
    "Pick one of Engage, Edify, Equip or Empower.",
  );

  const homeGroupId = trimmed(input.homeGroupId);
  if (homeGroupId !== null) {
    if (!UUID_PATTERN.test(homeGroupId)) {
      throw new RosterValidationError("That BGroup is not on your list.");
    }
    const rows = await query<{ archived_at: Date | null }>(
      "SELECT archived_at FROM groups WHERE owner_id = $1 AND id = $2",
      [ownerId, homeGroupId],
    );
    if (rows.length === 0) {
      throw new RosterValidationError("That BGroup is not on your list.");
    }
    // #60 — an archived BGroup takes no new members, the same rule #27's bulk
    // move already keeps. The exception is the member who was already there
    // when it was archived and the move was declined: they must stay editable,
    // or a group archived under them costs them their phone number too.
    if (rows[0].archived_at !== null && current?.homeGroupId !== homeGroupId) {
      throw new RosterValidationError("That BGroup is archived — pick one that is running.");
    }
  }

  return {
    name,
    phone,
    email,
    homeGroupId,
    joinedOn,
    birthday,
    address: trimmed(input.address),
    civilStatus,
    spiritualStatus,
    baptized,
    baptizedOn: baptized ? baptizedOn : null,
    invitedBy: trimmed(input.invitedBy),
    notes: trimmed(input.notes),
  };
}

/** Empty is the same as absent everywhere on this form. */
function trimmed(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  return text.length === 0 ? null : text;
}

function day(value: string | null | undefined, message: string): string | null {
  const text = trimmed(value);
  if (text === null) return null;
  if (!isCalendarDate(text)) throw new RosterValidationError(message);
  return text;
}

function oneOf<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  message: string,
): T | null {
  const text = trimmed(value);
  if (text === null) return null;
  if (!allowed.includes(text as T)) throw new RosterValidationError(message);
  return text as T;
}
