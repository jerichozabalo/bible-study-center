import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  TEST_OWNER,
  bookIdByNumber,
  dbConfigured,
  ensureSchema,
  resetRoster,
} from "../../../tests/fixtures";
import {
  addCancelledMeeting,
  addGeneratedMeeting,
  addHeldMeeting,
  resetMeetings,
  sessionIdByNumber,
} from "../../../tests/meeting-fixtures";
import { recordSheet } from "../attendance/completions";
import { query } from "../db";
import { seedCurriculum } from "../curriculum/seed";
import { createPerson } from "../roster/people";
import { archiveGroup, createGroup, getGroup } from "../roster/groups";
import {
  MeetingValidationError,
  changeMeetingSession,
  createMeeting,
  deleteMeeting,
  getMeeting,
  listMeetingLog,
  listUpcomingMeetings,
  setGroupSchedule,
  updateMeeting,
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

  it("is idempotent when a queued creation replays with the same client id (#72/#73)", async () => {
    // The outbox (#72) gives a queued meeting a stable client id and replays it
    // on reconnect; a flush that failed after the row was written retries with
    // the same id. #73's partial index is scoped to generated meetings, so the
    // id itself is what keeps a created meeting from being written twice.
    const clientId = crypto.randomUUID();

    const first = await createMeeting(TEST_OWNER, meeting({ clientId }));
    const second = await createMeeting(
      TEST_OWNER,
      // Same id, different fields: the replay must return the first row
      // untouched, not a second meeting and not an edit.
      meeting({ clientId, date: "2099-12-25" }),
    );

    expect(second).toBe(first);
    expect((await getMeeting(TEST_OWNER, first))?.date).toBe("2026-08-23");
    expect((await listUpcomingMeetings(TEST_OWNER, { from: "2026-08-01" })).length).toBe(1);
  });

  it("still takes a same-day make-up meeting when each carries its own client id (#73)", async () => {
    const regular = await createMeeting(TEST_OWNER, meeting({ clientId: crypto.randomUUID() }));
    const makeUp = await createMeeting(TEST_OWNER, meeting({ clientId: crypto.randomUUID() }));

    expect(makeUp).not.toBe(regular);
    expect((await listUpcomingMeetings(TEST_OWNER, { from: "2026-08-01" })).length).toBe(2);
  });

  it("refuses a client id that is not a UUID", async () => {
    await expect(
      createMeeting(TEST_OWNER, meeting({ clientId: "not-a-uuid" })),
    ).rejects.toBeInstanceOf(MeetingValidationError);
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

  it("logs every meeting up to today, newest first — the future never lands (bst-v1.2 #1)", async () => {
    // The Meeting page's default view: the log is the record of nights that
    // are done (today counts). Tomorrow's proposed rows are the calendar's.
    await addGeneratedMeeting(TEST_OWNER, group, "2026-09-14"); // still ahead
    await addGeneratedMeeting(TEST_OWNER, group, "2026-09-21"); // still ahead
    await addHeldMeeting(TEST_OWNER, group, "2026-09-08");
    await addCancelledMeeting(TEST_OWNER, group, "2026-09-10");

    const log = await listMeetingLog(TEST_OWNER, { to: "2026-09-11" });

    expect(log.map((row) => row.date)).toEqual(["2026-09-10", "2026-09-08"]);
    expect(log[0]).toMatchObject({ groupName: "BGroup Linggo", status: "cancelled" });
  });

  it("keeps a day's own nights in evening order (bst-v1.2 #1)", async () => {
    await addGeneratedMeeting(TEST_OWNER, group, "2026-09-08", "16:00");
    await createMeeting(TEST_OWNER, meeting({ date: "2026-09-08", startTime: "19:00" }));

    const log = await listMeetingLog(TEST_OWNER, { to: "2026-09-11" });

    expect(log.map((row) => row.date)).toEqual(["2026-09-08", "2026-09-08"]);
    expect(log.map((row) => row.startTime)).toEqual(["16:00:00", "19:00:00"]);
  });

  it("includes a night dated today — the boundary is today, not before it (bst-v1.2 #1)", async () => {
    await addHeldMeeting(TEST_OWNER, group, "2026-09-11"); // tonight
    await addGeneratedMeeting(TEST_OWNER, group, "2026-09-12"); // tomorrow

    const log = await listMeetingLog(TEST_OWNER, { to: "2026-09-11" });

    expect(log.map((row) => row.date)).toEqual(["2026-09-11"]);
  });

  it("shows all three statuses — nothing in the log is hidden (#50/#52)", async () => {
    await addHeldMeeting(TEST_OWNER, group, "2026-09-08");
    await addCancelledMeeting(TEST_OWNER, group, "2026-09-09");
    await addGeneratedMeeting(TEST_OWNER, group, "2026-09-10"); // past-due proposed

    const log = await listMeetingLog(TEST_OWNER, { to: "2026-09-11" });

    expect(log.map((row) => row.status).sort()).toEqual(["cancelled", "held", "proposed"]);
  });

  it("keeps another leader's meetings out of the log (#32)", async () => {
    await addHeldMeeting(TEST_OWNER, group, "2026-09-08");

    expect(await listMeetingLog("someone.else@example.com", { to: "2026-09-11" })).toEqual([]);
  });

  it("returns nothing for an unreadable date, and nothing when the log is empty", async () => {
    expect(await listMeetingLog(TEST_OWNER, { to: "tonight" })).toEqual([]);
    expect(await listMeetingLog(TEST_OWNER, { to: "2026-09-11" })).toEqual([]);
  });

  describe("changeMeetingSession", () => {
    it("corrects a still-PROPOSED meeting's session", async () => {
      const wrong = await createMeeting(
        TEST_OWNER,
        meeting({ sessionId: await sessionIdByNumber(bookOne, 1) }),
      );

      await changeMeetingSession(TEST_OWNER, wrong, sessionThree);

      expect(await getMeeting(TEST_OWNER, wrong)).toMatchObject({
        sessionId: sessionThree,
        sessionNumber: 3,
        status: "proposed",
      });
    });

    it("refuses to change a HELD meeting's session (#24 — history does not rewrite)", async () => {
      const held = await addHeldMeeting(TEST_OWNER, group, "2026-09-08", {
        bookId: bookOne,
        sessionId: await sessionIdByNumber(bookOne, 1),
      });

      await expect(changeMeetingSession(TEST_OWNER, held, sessionThree)).rejects.toBeInstanceOf(
        MeetingValidationError,
      );
      expect(await getMeeting(TEST_OWNER, held)).toMatchObject({ sessionNumber: 1 });
    });

    it("refuses a session from a different book than the meeting's own", async () => {
      const id = await createMeeting(TEST_OWNER, meeting());
      const otherSession = await sessionIdByNumber(await bookIdByNumber(2), 1);

      await expect(changeMeetingSession(TEST_OWNER, id, otherSession)).rejects.toBeInstanceOf(
        MeetingValidationError,
      );
    });

    it("allows clearing to no session — a fellowship night (#26)", async () => {
      const id = await createMeeting(TEST_OWNER, meeting());

      await changeMeetingSession(TEST_OWNER, id, null);

      expect(await getMeeting(TEST_OWNER, id)).toMatchObject({ sessionId: null, sessionNumber: null });
    });

    it("refuses a meeting that does not belong to this leader", async () => {
      const id = await createMeeting(TEST_OWNER, meeting());

      await expect(
        changeMeetingSession("someone.else@example.com", id, sessionThree),
      ).rejects.toBeInstanceOf(MeetingValidationError);
    });
  });

  describe("updateMeeting", () => {
    it("corrects a meeting's date, time, duration and notes, whatever its status (#75)", async () => {
      const held = await addHeldMeeting(TEST_OWNER, group, "2026-09-08", {
        bookId: bookOne,
        sessionId: sessionThree,
      });

      await updateMeeting(TEST_OWNER, held, {
        date: "2026-09-09",
        startTime: "18:30",
        durationMinutes: 60,
        notes: "Actually a day later — wrong date typed in the room",
      });

      expect(await getMeeting(TEST_OWNER, held)).toMatchObject({
        date: "2026-09-09",
        startTime: "18:30:00",
        durationMinutes: 60,
        notes: "Actually a day later — wrong date typed in the room",
        status: "held",
        sessionId: sessionThree,
      });
    });

    it("leaves the book and session untouched — that is changeMeetingSession's job", async () => {
      const id = await createMeeting(TEST_OWNER, meeting());

      await updateMeeting(TEST_OWNER, id, {
        date: "2026-08-24",
        startTime: "19:00",
        durationMinutes: 90,
        notes: null,
      });

      expect(await getMeeting(TEST_OWNER, id)).toMatchObject({
        bookId: bookOne,
        sessionId: sessionThree,
      });
    });

    it("clears notes to null when posted blank", async () => {
      const id = await createMeeting(TEST_OWNER, meeting({ notes: "Sa bahay nina Ben" }));

      await updateMeeting(TEST_OWNER, id, {
        date: "2026-08-23",
        startTime: "16:00",
        durationMinutes: 90,
        notes: "   ",
      });

      expect(await getMeeting(TEST_OWNER, id)).toMatchObject({ notes: null });
    });

    it("refuses a date, time or duration it cannot read", async () => {
      const id = await createMeeting(TEST_OWNER, meeting());

      await expect(
        updateMeeting(TEST_OWNER, id, {
          date: "2026-02-30",
          startTime: "16:00",
          durationMinutes: 90,
          notes: null,
        }),
      ).rejects.toBeInstanceOf(MeetingValidationError);
      await expect(
        updateMeeting(TEST_OWNER, id, {
          date: "2026-08-23",
          startTime: "teatime",
          durationMinutes: 90,
          notes: null,
        }),
      ).rejects.toBeInstanceOf(MeetingValidationError);
      await expect(
        updateMeeting(TEST_OWNER, id, {
          date: "2026-08-23",
          startTime: "16:00",
          durationMinutes: 0,
          notes: null,
        }),
      ).rejects.toBeInstanceOf(MeetingValidationError);
    });

    it("refuses a meeting that does not belong to this leader, or does not exist", async () => {
      const id = await createMeeting(TEST_OWNER, meeting());
      const edit = { date: "2026-08-24", startTime: "19:00", durationMinutes: 90, notes: null };

      await expect(
        updateMeeting("someone.else@example.com", id, edit),
      ).rejects.toBeInstanceOf(MeetingValidationError);
      await expect(
        updateMeeting(TEST_OWNER, crypto.randomUUID(), edit),
      ).rejects.toBeInstanceOf(MeetingValidationError);
    });
  });

  describe("deleteMeeting", () => {
    it("deletes a still-PROPOSED meeting outright", async () => {
      const id = await createMeeting(TEST_OWNER, meeting());

      await deleteMeeting(TEST_OWNER, id);

      expect(await getMeeting(TEST_OWNER, id)).toBeNull();
    });

    it("deletes a HELD meeting, cascading its completions (#75 amends #24)", async () => {
      const held = await addHeldMeeting(TEST_OWNER, group, "2026-09-08", {
        bookId: bookOne,
        sessionId: sessionThree,
      });
      const personId = await createPerson(TEST_OWNER, { name: "Ben", homeGroupId: group });
      await recordSheet(TEST_OWNER, {
        meetingId: held,
        marks: [{ personId, mark: "attended" }],
        hold: true,
      });

      await deleteMeeting(TEST_OWNER, held);

      expect(await getMeeting(TEST_OWNER, held)).toBeNull();
      expect(
        await query("SELECT 1 FROM completions WHERE meeting_id = $1", [held]),
      ).toHaveLength(0);
    });

    it("refuses a meeting that does not belong to this leader, or does not exist", async () => {
      const id = await createMeeting(TEST_OWNER, meeting());

      await expect(
        deleteMeeting("someone.else@example.com", id),
      ).rejects.toBeInstanceOf(MeetingValidationError);
      await expect(
        deleteMeeting(TEST_OWNER, crypto.randomUUID()),
      ).rejects.toBeInstanceOf(MeetingValidationError);

      // Still there — the refused attempt above touched nothing.
      expect(await getMeeting(TEST_OWNER, id)).not.toBeNull();
    });
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
