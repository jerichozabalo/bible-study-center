import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  TEST_OWNER,
  addPerson,
  bookIdByNumber,
  dbConfigured,
  ensureSchema,
  resetRoster,
} from "../../../tests/fixtures";
import { seedCurriculum } from "../curriculum/seed";
import {
  RosterValidationError,
  archiveGroup,
  createGroup,
  getGroup,
  listArchivedGroups,
  listGroups,
  unarchiveGroup,
  updateGroup,
} from "./groups";

/**
 * BGroups at the module boundary — the same functions the screens call.
 *
 * The scenario every test starts from is the one in the issue: "BGroup Linggo,
 * Sundays 4pm, Book 1".
 */
describe.skipIf(!dbConfigured)("groups", () => {
  let bookOne: string;
  let bookTwo: string;

  beforeAll(async () => {
    await ensureSchema();
    await seedCurriculum();
    bookOne = await bookIdByNumber(1);
    bookTwo = await bookIdByNumber(2);
  });

  beforeEach(async () => {
    await resetRoster();
  });

  function linggo(overrides: Partial<Parameters<typeof createGroup>[1]> = {}) {
    return {
      name: "BGroup Linggo",
      weekday: 0,
      startTime: "16:00",
      durationMinutes: 90,
      currentBookId: bookOne,
      ...overrides,
    };
  }

  it("creates a BGroup with its schedule and current book", async () => {
    const id = await createGroup(TEST_OWNER, linggo());

    const group = await getGroup(TEST_OWNER, id);

    expect(group).toMatchObject({
      name: "BGroup Linggo",
      weekday: 0,
      startTime: "16:00:00",
      durationMinutes: 90,
      currentBookId: bookOne,
      currentBookNumber: 1,
      currentBookTitle: "One By One",
      currentBookSessionCount: 6,
      memberCount: 0,
      archivedAt: null,
    });
  });

  it("stamps the owner (#32)", async () => {
    const id = await createGroup(TEST_OWNER, linggo());

    expect(await getGroup("someone.else@example.com", id)).toBeNull();
    expect(await getGroup(TEST_OWNER, id)).not.toBeNull();
  });

  it("allows a group with no book chosen yet", async () => {
    const id = await createGroup(TEST_OWNER, linggo({ currentBookId: null }));

    expect(await getGroup(TEST_OWNER, id)).toMatchObject({
      currentBookId: null,
      currentBookTitle: null,
      currentBookSessionCount: 0,
    });
  });

  it("trims the name and refuses an empty one", async () => {
    const id = await createGroup(TEST_OWNER, linggo({ name: "  Tuesday BGroup  " }));
    expect(await getGroup(TEST_OWNER, id)).toMatchObject({ name: "Tuesday BGroup" });

    await expect(createGroup(TEST_OWNER, linggo({ name: "   " }))).rejects.toBeInstanceOf(
      RosterValidationError,
    );
  });

  it("refuses a schedule that is not a weekly day, time and length", async () => {
    await expect(createGroup(TEST_OWNER, linggo({ weekday: 7 }))).rejects.toBeInstanceOf(
      RosterValidationError,
    );
    await expect(createGroup(TEST_OWNER, linggo({ startTime: "teatime" }))).rejects.toBeInstanceOf(
      RosterValidationError,
    );
    await expect(createGroup(TEST_OWNER, linggo({ durationMinutes: 0 }))).rejects.toBeInstanceOf(
      RosterValidationError,
    );
  });

  it("refuses a book that does not exist", async () => {
    await expect(
      createGroup(TEST_OWNER, linggo({ currentBookId: "00000000-0000-0000-0000-000000000000" })),
    ).rejects.toBeInstanceOf(RosterValidationError);
  });

  it("counts the members whose home group it is (#15)", async () => {
    const id = await createGroup(TEST_OWNER, linggo());
    const other = await createGroup(TEST_OWNER, linggo({ name: "Tuesday BGroup", weekday: 2 }));
    await addPerson("Maria Santos", id);
    await addPerson("Ben Cruz", id);
    await addPerson("Joel Ramos", other);

    const groups = await listGroups(TEST_OWNER);

    expect(groups.find((group) => group.id === id)?.memberCount).toBe(2);
    expect(groups.find((group) => group.id === other)?.memberCount).toBe(1);
  });

  it("lists live groups alphabetically and keeps archived ones out (#60)", async () => {
    const linggoId = await createGroup(TEST_OWNER, linggo());
    await createGroup(TEST_OWNER, linggo({ name: "Alpha BGroup" }));
    const archived = await createGroup(TEST_OWNER, linggo({ name: "Wednesday Couples" }));

    await archiveGroup(TEST_OWNER, archived);

    expect((await listGroups(TEST_OWNER)).map((group) => group.name)).toEqual([
      "Alpha BGroup",
      "BGroup Linggo",
    ]);
    expect((await listArchivedGroups(TEST_OWNER)).map((group) => group.id)).toEqual([archived]);
    expect((await listGroups(TEST_OWNER)).map((group) => group.id)).toContain(linggoId);
  });

  it("archives rather than deletes, and records when (#27)", async () => {
    const id = await createGroup(TEST_OWNER, linggo());

    await archiveGroup(TEST_OWNER, id);

    const group = await getGroup(TEST_OWNER, id);
    expect(group?.archivedAt).toBeInstanceOf(Date);
  });

  it("moves the members to another group when archiving offers it (#27)", async () => {
    const closing = await createGroup(TEST_OWNER, linggo());
    const receiving = await createGroup(TEST_OWNER, linggo({ name: "Tuesday BGroup", weekday: 2 }));
    await addPerson("Maria Santos", closing);
    await addPerson("Ben Cruz", closing);
    const untouched = await addPerson("Joel Ramos", receiving);

    await archiveGroup(TEST_OWNER, closing, { moveMembersToGroupId: receiving });

    expect((await getGroup(TEST_OWNER, closing))?.memberCount).toBe(0);
    expect((await getGroup(TEST_OWNER, receiving))?.memberCount).toBe(3);
    expect(untouched).toBeTruthy();
  });

  it("leaves the members where they are when the offer is declined", async () => {
    const closing = await createGroup(TEST_OWNER, linggo());
    await addPerson("Maria Santos", closing);

    await archiveGroup(TEST_OWNER, closing);

    expect((await getGroup(TEST_OWNER, closing))?.memberCount).toBe(1);
  });

  it("refuses to move members into a group that is itself archived or gone", async () => {
    const closing = await createGroup(TEST_OWNER, linggo());
    const alsoArchived = await createGroup(TEST_OWNER, linggo({ name: "Wednesday Couples" }));
    await addPerson("Maria Santos", closing);
    await archiveGroup(TEST_OWNER, alsoArchived);

    await expect(
      archiveGroup(TEST_OWNER, closing, { moveMembersToGroupId: alsoArchived }),
    ).rejects.toBeInstanceOf(RosterValidationError);
    await expect(
      archiveGroup(TEST_OWNER, closing, { moveMembersToGroupId: closing }),
    ).rejects.toBeInstanceOf(RosterValidationError);

    // The failed move left the group live, not half-archived.
    expect((await getGroup(TEST_OWNER, closing))?.archivedAt).toBeNull();
  });

  it("edits the name, the schedule and the current book", async () => {
    const id = await createGroup(TEST_OWNER, linggo());

    await updateGroup(TEST_OWNER, id, {
      name: "BGroup Linggo (hapon)",
      weekday: 0,
      startTime: "17:30",
      durationMinutes: 60,
      currentBookId: bookTwo,
    });

    expect(await getGroup(TEST_OWNER, id)).toMatchObject({
      name: "BGroup Linggo (hapon)",
      startTime: "17:30:00",
      durationMinutes: 60,
      currentBookId: bookTwo,
      currentBookTitle: "Spiritual Disciplines",
    });
  });

  it("validates an edit the same way as a create", async () => {
    const id = await createGroup(TEST_OWNER, linggo());

    await expect(updateGroup(TEST_OWNER, id, linggo({ name: "" }))).rejects.toBeInstanceOf(
      RosterValidationError,
    );
  });

  it("refuses to edit an archived group, whatever screen asks", async () => {
    // QA pass 2026-08-21: the detail page hides Edit once a group is archived,
    // but `/people/groups/<id>/edit` answered 200 with a prefilled form and the
    // save went through. Hiding a control is not a rule — the rule belongs
    // here, where every screen has to come through it.
    const id = await createGroup(TEST_OWNER, linggo());
    await archiveGroup(TEST_OWNER, id);

    await expect(
      updateGroup(TEST_OWNER, id, linggo({ name: "Edited while archived" })),
    ).rejects.toBeInstanceOf(RosterValidationError);

    expect(await getGroup(TEST_OWNER, id)).toMatchObject({ name: "BGroup Linggo" });
  });

  it("brings an archived BGroup back, with its schedule and book intact", async () => {
    const id = await createGroup(TEST_OWNER, linggo());
    await archiveGroup(TEST_OWNER, id);

    await unarchiveGroup(TEST_OWNER, id);

    expect(await getGroup(TEST_OWNER, id)).toMatchObject({
      name: "BGroup Linggo",
      weekday: 0,
      startTime: "16:00:00",
      durationMinutes: 90,
      currentBookId: bookOne,
      archivedAt: null,
    });
    expect((await listGroups(TEST_OWNER)).map((group) => group.id)).toContain(id);
    expect((await listArchivedGroups(TEST_OWNER)).map((group) => group.id)).not.toContain(id);
  });

  it("leaves the members where the bulk move put them", async () => {
    // #27's move is not undone: those people have a different home BGroup now,
    // and pulling them back would be a second surprise. The group comes back
    // empty and they are moved by hand.
    const closing = await createGroup(TEST_OWNER, linggo());
    const receiving = await createGroup(TEST_OWNER, linggo({ name: "Tuesday BGroup", weekday: 2 }));
    await addPerson("Maria Santos", closing);
    await archiveGroup(TEST_OWNER, closing, { moveMembersToGroupId: receiving });

    await unarchiveGroup(TEST_OWNER, closing);

    expect((await getGroup(TEST_OWNER, closing))?.memberCount).toBe(0);
    expect((await getGroup(TEST_OWNER, receiving))?.memberCount).toBe(1);
  });

  it("can be picked again once it is back (#60)", async () => {
    const restored = await createGroup(TEST_OWNER, linggo());
    const closing = await createGroup(TEST_OWNER, linggo({ name: "Wednesday Couples", weekday: 3 }));
    await addPerson("Ben Cruz", closing);
    await archiveGroup(TEST_OWNER, restored);

    await unarchiveGroup(TEST_OWNER, restored);

    // A new member can name it as home again...
    const joel = await addPerson("Joel Ramos", restored);
    expect(joel).toBeTruthy();
    // ...and it can receive #27's bulk move, which only live groups may.
    await archiveGroup(TEST_OWNER, closing, { moveMembersToGroupId: restored });
    expect((await getGroup(TEST_OWNER, restored))?.memberCount).toBe(2);
  });

  it("is owner-scoped: another leader's id cannot bring it back (#32)", async () => {
    const id = await createGroup(TEST_OWNER, linggo());
    await archiveGroup(TEST_OWNER, id);

    await unarchiveGroup("someone-else@example.com", id);

    expect((await getGroup(TEST_OWNER, id))?.archivedAt).toBeInstanceOf(Date);
    expect((await listGroups(TEST_OWNER)).map((group) => group.id)).not.toContain(id);
  });
});
