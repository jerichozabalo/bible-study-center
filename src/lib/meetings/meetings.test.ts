import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  TEST_OWNER,
  bookIdByNumber,
  dbConfigured,
  ensureSchema,
  resetRoster,
} from "../../../tests/fixtures";
import {
  addGeneratedMeeting,
  resetMeetings,
  sessionIdByNumber,
} from "../../../tests/meeting-fixtures";
import { seedCurriculum } from "../curriculum/seed";
import { archiveGroup, createGroup, getGroup } from "../roster/groups";
import {
  MeetingValidationError,
  createMeeting,
  getMeeting,
  listUpcomingMeetings,
  setGroupSchedule,
} from "./meetings";

/**
 * Creating a meeting, at the module boundary the [+] screen posts to.
 */
describe.skipIf(!dbConfigured)("meetings", () => {
  let bookOne: string;
  let sessionThree: string;
  let group: string;

  beforeAll(async () => {
    await ensureSchema();
    await seedCurriculum();
    bookOne = await bookIdByNumber(1);
    sessionThree = await sessionIdByNumber(bookOne, 3);
  });

  beforeEach(async () => {
    await resetMeetings();
    await resetRoster();
    group = await createGroup(TEST_OWNER, {
      name: "BGroup Linggo",
      weekday: 0,
      startTime: "16:00",
      durationMinutes: 90,
      currentBookId: bookOne,
    });
  });

  it("creates a meeting the leader typed, stamped to them (#32)", async () => {
    const id = await createMeeting(TEST_OWNER, {
      groupId: group,
      date: "2026-08-23",
      startTime: null,
      durationMinutes: null,
      bookId: bookOne,
      sessionId: sessionThree,
      notes: "Sa bahay nina Ben — moved this week",
      repeatWeekly: false,
    });

    expect(await getMeeting(TEST_OWNER, id)).toMatchObject({
      groupId: group,
      groupName: "BGroup Linggo",
      date: "2026-08-23",
      bookId: bookOne,
      sessionId: sessionThree,
      sessionNumber: 3,
      notes: "Sa bahay nina Ben — moved this week",
      status: "proposed",
      origin: "created",
      ledBy: TEST_OWNER,
    });
    expect(await getMeeting("someone.else@example.com", id)).toBeNull();
  });

  it("always yields PROPOSED, whatever the date (#47)", async () => {
    const past = await createMeeting(TEST_OWNER, meeting({ date: "2019-01-06" }));
    const future = await createMeeting(TEST_OWNER, meeting({ date: "2099-01-04" }));

    expect((await getMeeting(TEST_OWNER, past))?.status).toBe("proposed");
    expect((await getMeeting(TEST_OWNER, future))?.status).toBe("proposed");
  });

  it("inherits the group's time and duration, and lets the night override them (#36)", async () => {
    const inherited = await createMeeting(TEST_OWNER, meeting());
    const moved = await createMeeting(
      TEST_OWNER,
      meeting({ date: "2026-08-30", startTime: "18:30", durationMinutes: 60 }),
    );

    expect(await getMeeting(TEST_OWNER, inherited)).toMatchObject({
      startTime: "16:00:00",
      durationMinutes: 90,
    });
    expect(await getMeeting(TEST_OWNER, moved)).toMatchObject({
      startTime: "18:30:00",
      durationMinutes: 60,
    });
  });

  it("allows a night with no session and no notes at all (#26/#55)", async () => {
    const id = await createMeeting(
      TEST_OWNER,
      meeting({ bookId: null, sessionId: null, notes: null }),
    );

    expect(await getMeeting(TEST_OWNER, id)).toMatchObject({
      bookId: null,
      sessionId: null,
      sessionNumber: null,
      notes: null,
      status: "proposed",
    });
  });

  it("takes a same-day make-up meeting beside a generated one (#73)", async () => {
    await addGeneratedMeeting(TEST_OWNER, group, "2026-08-23");

    const id = await createMeeting(TEST_OWNER, meeting({ date: "2026-08-23" }));

    expect((await getMeeting(TEST_OWNER, id))?.origin).toBe("created");
    expect((await listUpcomingMeetings(TEST_OWNER, { from: "2026-08-01" })).length).toBe(2);
  });

  it("refuses a second generated meeting on the same day (#73)", async () => {
    await addGeneratedMeeting(TEST_OWNER, group, "2026-08-23");

    await expect(addGeneratedMeeting(TEST_OWNER, group, "2026-08-23")).rejects.toThrow();
  });

  it("refuses an archived group (#60)", async () => {
    await archiveGroup(TEST_OWNER, group);

    await expect(createMeeting(TEST_OWNER, meeting())).rejects.toBeInstanceOf(
      MeetingValidationError,
    );
  });

  it("refuses a group that belongs to someone else", async () => {
    await expect(
      createMeeting("someone.else@example.com", meeting()),
    ).rejects.toBeInstanceOf(MeetingValidationError);
  });

  it("refuses a date or time it cannot read", async () => {
    await expect(createMeeting(TEST_OWNER, meeting({ date: "next Sunday" }))).rejects.toBeInstanceOf(
      MeetingValidationError,
    );
    await expect(
      createMeeting(TEST_OWNER, meeting({ date: "2026-02-30" })),
    ).rejects.toBeInstanceOf(MeetingValidationError);
    await expect(
      createMeeting(TEST_OWNER, meeting({ startTime: "teatime" })),
    ).rejects.toBeInstanceOf(MeetingValidationError);
  });

  it("refuses a session that is not in the meeting's book", async () => {
    const otherSession = await sessionIdByNumber(await bookIdByNumber(2), 1);

    await expect(
      createMeeting(TEST_OWNER, meeting({ bookId: bookOne, sessionId: otherSession })),
    ).rejects.toBeInstanceOf(MeetingValidationError);
  });

  it("sets the group's own schedule when the night is meant to repeat (#48)", async () => {
    await createMeeting(
      TEST_OWNER,
      // A Wednesday, at a new time.
      meeting({ date: "2026-08-26", startTime: "18:30", durationMinutes: 60, repeatWeekly: true }),
    );

    expect(await getGroup(TEST_OWNER, group)).toMatchObject({
      weekday: 3,
      startTime: "18:30:00",
      durationMinutes: 60,
    });
  });

  it("leaves the group's schedule alone when the night does not repeat", async () => {
    await createMeeting(TEST_OWNER, meeting({ date: "2026-08-26", startTime: "18:30" }));

    expect(await getGroup(TEST_OWNER, group)).toMatchObject({
      weekday: 0,
      startTime: "16:00:00",
    });
  });

  it("sets a group's schedule from either place (#48)", async () => {
    await setGroupSchedule(TEST_OWNER, group, {
      weekday: 2,
      startTime: "20:00",
      durationMinutes: 45,
    });

    expect(await getGroup(TEST_OWNER, group)).toMatchObject({
      weekday: 2,
      startTime: "20:00:00",
      durationMinutes: 45,
    });
  });

  it("lists the next meetings for Home, soonest first, past ones left out", async () => {
    const later = await createMeeting(TEST_OWNER, meeting({ date: "2026-08-30" }));
    const sooner = await createMeeting(TEST_OWNER, meeting({ date: "2026-08-23" }));
    await createMeeting(TEST_OWNER, meeting({ date: "2026-08-01" }));

    const upcoming = await listUpcomingMeetings(TEST_OWNER, { from: "2026-08-20", limit: 5 });

    expect(upcoming.map((row) => row.id)).toEqual([sooner, later]);
    expect(upcoming[0]).toMatchObject({ groupName: "BGroup Linggo", date: "2026-08-23" });
  });

  it("keeps another leader's meetings off the Home list (#32)", async () => {
    await createMeeting(TEST_OWNER, meeting({ date: "2026-08-23" }));

    expect(await listUpcomingMeetings("someone.else@example.com", { from: "2026-08-01" })).toEqual(
      [],
    );
  });

  function meeting(overrides: Partial<Parameters<typeof createMeeting>[1]> = {}) {
    return {
      groupId: group,
      date: "2026-08-23",
      startTime: null,
      durationMinutes: null,
      bookId: bookOne,
      sessionId: sessionThree,
      notes: null,
      repeatWeekly: false,
      ...overrides,
    };
  }
});
