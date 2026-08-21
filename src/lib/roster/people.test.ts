import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  TEST_OWNER,
  bookIdByNumber,
  dbConfigured,
  ensureSchema,
  resetRoster,
} from "../../../tests/fixtures";
import { seedCurriculum } from "../curriculum/seed";
import { manilaToday } from "../dates";
import { RosterValidationError, archiveGroup, createGroup } from "./groups";
import {
  createPerson,
  getPerson,
  listPeople,
  listPersonCorrections,
  listRemovedPeople,
  removePerson,
  restorePerson,
  setSteppedAway,
  updatePerson,
} from "./people";

/**
 * The roster at the module boundary — the same functions the People screens
 * call. The people are the boards' own: Nena Villamor of the Tuesday BGroup.
 */
describe.skipIf(!dbConfigured)("people", () => {
  let bookOne: string;

  beforeAll(async () => {
    await ensureSchema();
    await seedCurriculum();
    bookOne = await bookIdByNumber(1);
  });

  let tuesday: string;

  beforeEach(async () => {
    await resetRoster();
    tuesday = await createGroup(TEST_OWNER, {
      name: "Tuesday BGroup",
      weekday: 2,
      startTime: "19:00",
      durationMinutes: 90,
      currentBookId: bookOne,
    });
  });

  function nena(overrides: Partial<Parameters<typeof createPerson>[1]> = {}) {
    return {
      name: "Nena Villamor",
      phone: "0917 555 0184",
      email: "nena.villamor@gmail.com",
      homeGroupId: tuesday,
      joinedOn: "2026-06-02",
      birthday: "1988-03-14",
      address: "Blk 7 Lot 12, Muzon, SJDM",
      civilStatus: "Married",
      spiritualStatus: "Edify",
      baptized: true,
      baptizedOn: "2024-05-03",
      invitedBy: "Maria Santos",
      notes: "Works nights on Thursdays.",
      ...overrides,
    };
  }

  it("saves the whole record and reads it back", async () => {
    const id = await createPerson(TEST_OWNER, nena());

    expect(await getPerson(TEST_OWNER, id)).toMatchObject({
      name: "Nena Villamor",
      phone: "0917 555 0184",
      email: "nena.villamor@gmail.com",
      homeGroupId: tuesday,
      homeGroupName: "Tuesday BGroup",
      joinedOn: "2026-06-02",
      birthday: "1988-03-14",
      address: "Blk 7 Lot 12, Muzon, SJDM",
      civilStatus: "Married",
      spiritualStatus: "Edify",
      baptized: true,
      baptizedOn: "2024-05-03",
      invitedBy: "Maria Santos",
      notes: "Works nights on Thursdays.",
      contactIncomplete: false,
      steppedAwayOn: null,
      removedAt: null,
    });
  });

  it("stamps the owner (#32)", async () => {
    const id = await createPerson(TEST_OWNER, nena());

    expect(await getPerson("someone.else@example.com", id)).toBeNull();
    expect(await getPerson(TEST_OWNER, id)).not.toBeNull();
  });

  /**
   * #67 — the walk-in path issue 6 depends on. A name alone is a save, not a
   * refusal; #9's phone-or-email is deferred, and the flag is what remembers.
   */
  it("saves a walk-in on a name alone and flags the contact incomplete (#9/#67)", async () => {
    const id = await createPerson(TEST_OWNER, { name: "Nico" });

    expect(await getPerson(TEST_OWNER, id)).toMatchObject({
      name: "Nico",
      phone: null,
      email: null,
      homeGroupId: null,
      contactIncomplete: true,
    });
  });

  it("clears the incomplete flag as soon as one contact detail lands (#67)", async () => {
    const id = await createPerson(TEST_OWNER, { name: "Nico" });

    await updatePerson(TEST_OWNER, id, { name: "Nico Reyes", email: "nico@example.com" });

    expect(await getPerson(TEST_OWNER, id)).toMatchObject({
      phone: null,
      email: "nico@example.com",
      contactIncomplete: false,
    });
  });

  it("trims the name and refuses an empty one", async () => {
    const id = await createPerson(TEST_OWNER, nena({ name: "  Ben Cruz  " }));
    expect(await getPerson(TEST_OWNER, id)).toMatchObject({ name: "Ben Cruz" });

    await expect(createPerson(TEST_OWNER, nena({ name: "   " }))).rejects.toBeInstanceOf(
      RosterValidationError,
    );
  });

  it("refuses contact details that cannot be a phone or an address", async () => {
    await expect(createPerson(TEST_OWNER, nena({ email: "nena at gmail" }))).rejects.toBeInstanceOf(
      RosterValidationError,
    );
    await expect(createPerson(TEST_OWNER, nena({ phone: "0917" }))).rejects.toBeInstanceOf(
      RosterValidationError,
    );
  });

  it("keeps the 4E status and refuses anything outside it (#11)", async () => {
    const id = await createPerson(TEST_OWNER, nena({ spiritualStatus: "Empower" }));
    expect(await getPerson(TEST_OWNER, id)).toMatchObject({ spiritualStatus: "Empower" });

    await expect(
      createPerson(TEST_OWNER, nena({ spiritualStatus: "Discipled" })),
    ).rejects.toBeInstanceOf(RosterValidationError);
    await expect(
      createPerson(TEST_OWNER, nena({ civilStatus: "Complicated" })),
    ).rejects.toBeInstanceOf(RosterValidationError);
  });

  it("refuses dates that are not days, and a birthday in the future", async () => {
    await expect(createPerson(TEST_OWNER, nena({ birthday: "14/03/1988" }))).rejects.toBeInstanceOf(
      RosterValidationError,
    );
    await expect(createPerson(TEST_OWNER, nena({ birthday: "2999-01-01" }))).rejects.toBeInstanceOf(
      RosterValidationError,
    );
  });

  /** Baptism is separate from the 4E ladder (#11), and the date is the stronger claim. */
  it("takes a baptized date as saying they are baptized, and drops the date when they are not", async () => {
    const dated = await createPerson(TEST_OWNER, nena({ baptized: false, baptizedOn: "2024-05-03" }));
    expect(await getPerson(TEST_OWNER, dated)).toMatchObject({
      baptized: true,
      baptizedOn: "2024-05-03",
    });

    const neither = await createPerson(
      TEST_OWNER,
      nena({ name: "Grace Bautista", baptized: false, baptizedOn: null }),
    );
    expect(await getPerson(TEST_OWNER, neither)).toMatchObject({
      baptized: false,
      baptizedOn: null,
    });
  });

  it("derives the age from the birthday rather than storing one (#9b)", async () => {
    const id = await createPerson(TEST_OWNER, nena({ birthday: "1988-03-14" }));
    const noBirthday = await createPerson(TEST_OWNER, { name: "Nico" });

    const [year] = manilaToday().split("-").map(Number);
    expect(await getPerson(TEST_OWNER, id)).toMatchObject({ age: year - 1988 });
    expect(await getPerson(TEST_OWNER, noBirthday)).toMatchObject({ age: null });
  });

  it("defaults the joined date to today when none is given", async () => {
    const id = await createPerson(TEST_OWNER, { name: "Nico" });

    expect(await getPerson(TEST_OWNER, id)).toMatchObject({ joinedOn: manilaToday() });
  });

  /**
   * #28 — a mid-book joiner is genuinely behind, and the marker is what keeps
   * the catch-up list readable later: the day they joined that group, and the
   * book the group was on when they did.
   */
  it("records a joined-at marker for the home group (#28)", async () => {
    const id = await createPerson(TEST_OWNER, nena());

    const person = await getPerson(TEST_OWNER, id);

    expect(person?.memberships).toHaveLength(1);
    expect(person?.memberships[0]).toMatchObject({
      groupId: tuesday,
      groupName: "Tuesday BGroup",
      joinedOn: "2026-06-02",
      bookId: bookOne,
      bookNumber: 1,
      bookTitle: "One By One",
      endedOn: null,
    });
  });

  it("opens a marker when a person with no BGroup is given one", async () => {
    const id = await createPerson(TEST_OWNER, { name: "Nico" });
    expect((await getPerson(TEST_OWNER, id))?.memberships).toHaveLength(0);

    await updatePerson(TEST_OWNER, id, { name: "Nico", homeGroupId: tuesday });

    expect((await getPerson(TEST_OWNER, id))?.memberships).toMatchObject([
      { groupId: tuesday, joinedOn: manilaToday(), endedOn: null },
    ]);
  });

  /**
   * #15/#27 — one home group, and a transfer moves it without touching
   * anything the person has covered.
   *
   * Completions arrive with issue 6 and there is no such table yet, so what is
   * asserted here is the mechanism that makes #27 true: a transfer writes the
   * home group and the two markers, and leaves every other field of the person
   * exactly as it was. Nothing person-scoped is deleted or rewritten.
   */
  it("transfers the home group, keeps both markers and leaves the record untouched (#15/#27)", async () => {
    const sunday = await createGroup(TEST_OWNER, {
      name: "Sunday Youth",
      weekday: 0,
      startTime: "16:00",
      durationMinutes: 90,
      currentBookId: null,
    });
    const id = await createPerson(TEST_OWNER, nena());
    const before = await getPerson(TEST_OWNER, id);

    await updatePerson(TEST_OWNER, id, { ...nena(), homeGroupId: sunday });

    const after = await getPerson(TEST_OWNER, id);
    expect(after).toMatchObject({ homeGroupId: sunday, homeGroupName: "Sunday Youth" });
    // Everything that is not the home group survived the move.
    expect(after).toMatchObject({
      name: before!.name,
      phone: before!.phone,
      email: before!.email,
      birthday: before!.birthday,
      spiritualStatus: before!.spiritualStatus,
      baptizedOn: before!.baptizedOn,
      joinedOn: before!.joinedOn,
      notes: before!.notes,
    });

    // The old marker is closed rather than deleted (#24), newest first.
    expect(after?.memberships).toMatchObject([
      { groupId: sunday, joinedOn: manilaToday(), endedOn: null },
      { groupId: tuesday, joinedOn: "2026-06-02", endedOn: manilaToday() },
    ]);
  });

  it("moves the marker too when archiving bulk-moves the members (#27/#28)", async () => {
    const sunday = await createGroup(TEST_OWNER, {
      name: "Sunday Youth",
      weekday: 0,
      startTime: "16:00",
      durationMinutes: 90,
      currentBookId: null,
    });
    const id = await createPerson(TEST_OWNER, nena());

    await archiveGroup(TEST_OWNER, tuesday, { moveMembersToGroupId: sunday });

    const person = await getPerson(TEST_OWNER, id);
    expect(person).toMatchObject({ homeGroupId: sunday });
    expect(person?.memberships).toMatchObject([
      { groupId: sunday, endedOn: null },
      { groupId: tuesday, endedOn: manilaToday() },
    ]);
  });

  /**
   * #60 keeps an archived BGroup out of every picker — including this one. The
   * exception is the member who was already there when it was archived and
   * #27's move was declined: editing their phone number must not fail because
   * of where they stand.
   */
  it("refuses an archived BGroup as a home group, except the one they are already in", async () => {
    const id = await createPerson(TEST_OWNER, nena());
    const closed = await createGroup(TEST_OWNER, {
      name: "Wednesday Couples",
      weekday: 3,
      startTime: "19:00",
      durationMinutes: 90,
      currentBookId: null,
    });
    await archiveGroup(TEST_OWNER, closed);

    await expect(
      updatePerson(TEST_OWNER, id, { ...nena(), homeGroupId: closed }),
    ).rejects.toBeInstanceOf(RosterValidationError);

    // Their own group archived under them, move declined: still editable.
    await archiveGroup(TEST_OWNER, tuesday);
    await updatePerson(TEST_OWNER, id, { ...nena(), phone: "0917 555 0199" });
    expect(await getPerson(TEST_OWNER, id)).toMatchObject({
      phone: "0917 555 0199",
      homeGroupId: tuesday,
    });
  });

  it("refuses a BGroup that does not exist or belongs to someone else", async () => {
    await expect(
      createPerson(TEST_OWNER, nena({ homeGroupId: "00000000-0000-0000-0000-000000000000" })),
    ).rejects.toBeInstanceOf(RosterValidationError);
  });

  /** #24 — a correction keeps what it replaced. */
  it("tombstones the previous record on an edit (#24)", async () => {
    const id = await createPerson(TEST_OWNER, nena());

    await updatePerson(TEST_OWNER, id, nena({ name: "Nena Villamor-Cruz", civilStatus: "Widowed" }));

    const corrections = await listPersonCorrections(TEST_OWNER, id);
    expect(corrections).toHaveLength(1);
    expect(corrections[0].reason).toBe("edit");
    expect(corrections[0].previous).toMatchObject({
      name: "Nena Villamor",
      civil_status: "Married",
    });
    expect(await getPerson(TEST_OWNER, id)).toMatchObject({ name: "Nena Villamor-Cruz" });
  });

  /** #10/#66 — the manual override. The word is "Stepped away", never "Closed". */
  it("marks a person stepped away and back again, tombstoning both (#10/#66)", async () => {
    const id = await createPerson(TEST_OWNER, nena());

    await setSteppedAway(TEST_OWNER, id, true);
    expect(await getPerson(TEST_OWNER, id)).toMatchObject({ steppedAwayOn: manilaToday() });

    await setSteppedAway(TEST_OWNER, id, false);
    expect(await getPerson(TEST_OWNER, id)).toMatchObject({ steppedAwayOn: null });

    expect((await listPersonCorrections(TEST_OWNER, id)).map((c) => c.reason)).toEqual([
      "stepped-away",
      "stepped-away",
    ]);
  });

  /** #24 — nothing is truly erased, so removal is a date and a way back. */
  it("removes a person from the roster without erasing them (#24)", async () => {
    const id = await createPerson(TEST_OWNER, nena());

    await removePerson(TEST_OWNER, id);

    expect((await listPeople(TEST_OWNER)).map((p) => p.id)).not.toContain(id);
    expect((await listRemovedPeople(TEST_OWNER)).map((p) => p.id)).toEqual([id]);
    expect(await getPerson(TEST_OWNER, id)).toMatchObject({ name: "Nena Villamor" });
    expect((await getPerson(TEST_OWNER, id))?.removedAt).toBeInstanceOf(Date);

    await restorePerson(TEST_OWNER, id);
    expect((await listPeople(TEST_OWNER)).map((p) => p.id)).toEqual([id]);
    expect((await listPersonCorrections(TEST_OWNER, id)).map((c) => c.reason)).toEqual([
      "removed",
      "restored",
    ]);
  });

  /** The roster card's second line on the People board: BGroup and its book. */
  it("lists the roster alphabetically with the BGroup each person belongs to", async () => {
    await createPerson(TEST_OWNER, nena({ name: "Maria Santos" }));
    await createPerson(TEST_OWNER, nena({ name: "ben cruz" }));
    await createPerson(TEST_OWNER, { name: "Nico" });

    expect(await listPeople(TEST_OWNER)).toMatchObject([
      {
        name: "ben cruz",
        homeGroupName: "Tuesday BGroup",
        homeGroupBookNumber: 1,
        homeGroupBookTitle: "One By One",
      },
      { name: "Maria Santos", homeGroupName: "Tuesday BGroup" },
      {
        name: "Nico",
        homeGroupName: null,
        homeGroupBookNumber: null,
        homeGroupBookTitle: null,
        contactIncomplete: true,
      },
    ]);
  });

  it("searches by part of a name or by the digits of a number", async () => {
    await createPerson(TEST_OWNER, nena());
    await createPerson(TEST_OWNER, nena({ name: "Ben Cruz", phone: "0908 111 2233", email: null }));

    expect((await listPeople(TEST_OWNER, { search: "cru" })).map((p) => p.name)).toEqual([
      "Ben Cruz",
    ]);
    expect((await listPeople(TEST_OWNER, { search: "0184" })).map((p) => p.name)).toEqual([
      "Nena Villamor",
    ]);
    expect((await listPeople(TEST_OWNER, { search: "555-0184" })).map((p) => p.name)).toEqual([
      "Nena Villamor",
    ]);
    expect(await listPeople(TEST_OWNER, { search: "zzz" })).toEqual([]);
  });
});
