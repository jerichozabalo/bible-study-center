import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  TEST_OWNER,
  bookIdByNumber,
  dbConfigured,
  ensureSchema,
  resetRoster,
} from "../../../tests/fixtures";
import { resetMeetings, sessionIdByNumber } from "../../../tests/meeting-fixtures";
import { seedCurriculum } from "../curriculum/seed";
import { createMeeting } from "../meetings/meetings";
import { createGroup } from "../roster/groups";
import { createPerson, removePerson, updatePerson } from "../roster/people";
import { addWalkIn, recordSheet } from "./completions";
import { getSheet } from "./sheet";

/**
 * The sheet a meeting opens on: who is on it, and what they are marked as.
 */
describe.skipIf(!dbConfigured)("attendance sheet", () => {
  let bookOne: string;
  let sessionFour: string;
  let group: string;
  let maria: string;
  let ben: string;
  let meeting: string;

  beforeAll(async () => {
    await ensureSchema();
    await seedCurriculum();
    bookOne = await bookIdByNumber(1);
    sessionFour = await sessionIdByNumber(bookOne, 4);
  });

  beforeEach(async () => {
    await resetMeetings();
    await resetRoster();

    group = await createGroup(TEST_OWNER, {
      name: "BGroup Martes",
      weekday: 2,
      startTime: "19:00",
      durationMinutes: 90,
      currentBookId: bookOne,
    });
    // With numbers, so the walk-in's incomplete flag (#67) is the only one on
    // the sheet rather than the state everybody is in.
    maria = await createPerson(TEST_OWNER, {
      name: "Maria Santos",
      phone: "0917 555 0184",
      homeGroupId: group,
    });
    ben = await createPerson(TEST_OWNER, {
      name: "Ben Cruz",
      phone: "0917 555 0102",
      homeGroupId: group,
    });
    meeting = await createMeeting(TEST_OWNER, {
      groupId: group,
      date: "2026-08-25",
      startTime: null,
      durationMinutes: null,
      bookId: bookOne,
      sessionId: sessionFour,
      notes: null,
      repeatWeekly: false,
    });
  });

  it("opens on the BGroup's roster, unmarked, with the night it belongs to", async () => {
    const sheet = await getSheet(TEST_OWNER, meeting);

    expect(sheet?.meeting).toMatchObject({
      groupName: "BGroup Martes",
      date: "2026-08-25",
      sessionId: sessionFour,
      sessionNumber: 4,
      status: "proposed",
    });
    expect(sheet?.people).toMatchObject([
      { personId: ben, name: "Ben Cruz", mark: null, homeGroupId: group },
      { personId: maria, name: "Maria Santos", mark: null },
    ]);
  });

  it("carries the marks back when a held sheet is reopened (#24)", async () => {
    await recordSheet(TEST_OWNER, {
      meetingId: meeting,
      marks: [
        { personId: maria, mark: "attended" },
        { personId: ben, mark: "present-only" },
      ],
      hold: true,
    });

    const sheet = await getSheet(TEST_OWNER, meeting);

    expect(sheet?.meeting.status).toBe("held");
    expect(sheet?.people).toMatchObject([
      { personId: ben, mark: "present-only" },
      { personId: maria, mark: "attended" },
    ]);
  });

  /**
   * The seam issue 7 renders: a completion whose meeting's group is not the
   * person's home group IS the visit (#31). Nothing here calls them a guest —
   * it only refuses to lose them.
   */
  it("keeps someone who was marked and has since moved BGroup (#27/#31)", async () => {
    await recordSheet(TEST_OWNER, {
      meetingId: meeting,
      marks: [{ personId: maria, mark: "attended" }],
      hold: true,
    });
    const sunday = await createGroup(TEST_OWNER, {
      name: "BGroup Linggo",
      weekday: 0,
      startTime: "16:00",
      durationMinutes: 90,
      currentBookId: bookOne,
    });
    await updatePerson(TEST_OWNER, maria, { name: "Maria Santos", homeGroupId: sunday });

    expect((await getSheet(TEST_OWNER, meeting))?.people).toMatchObject([
      { personId: ben, mark: null },
      { personId: maria, mark: "attended", homeGroupId: sunday, homeGroupName: "BGroup Linggo" },
    ]);
  });

  it("drops someone removed from the roster, unless the night already records them (#24)", async () => {
    await recordSheet(TEST_OWNER, {
      meetingId: meeting,
      marks: [{ personId: maria, mark: "attended" }],
      hold: true,
    });
    await removePerson(TEST_OWNER, maria);
    await removePerson(TEST_OWNER, ben);

    expect((await getSheet(TEST_OWNER, meeting))?.people).toMatchObject([
      { personId: maria, mark: "attended" },
    ]);
  });

  it("flags a walk-in as still owing a contact detail (#9/#67)", async () => {
    const nico = await addWalkIn(TEST_OWNER, meeting, "Nico");

    const sheet = await getSheet(TEST_OWNER, meeting);

    expect(sheet?.people).toMatchObject([
      { personId: ben, contactIncomplete: false },
      { personId: maria, contactIncomplete: false },
      { personId: nico, name: "Nico", mark: "attended", contactIncomplete: true },
    ]);
  });

  it("is nothing to another leader, or for an id that is not a meeting (#32)", async () => {
    expect(await getSheet("someone.else@example.com", meeting)).toBeNull();
    expect(await getSheet(TEST_OWNER, "not-a-meeting")).toBeNull();
  });
});
