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
import { createGroup } from "../roster/groups";
import { createMeeting } from "./meetings";
import {
  cancelMeeting,
  getCalendar,
  materializeSchedule,
  resolveMeeting,
  shiftProposedMeetings,
} from "./calendar";

/**
 * Issue 5: the calendar page's data layer — the materialiser, the range query,
 * past-due resolution, cancellation, and schedule-change row migration.
 *
 * The scenario: BGroup Linggo meets Sundays at 4pm, current book Book 1.
 */
describe.skipIf(!dbConfigured)("calendar", () => {
  let bookOne: string;
  let sessionOne: string;
  let group: string;

  beforeAll(async () => {
    await ensureSchema();
    await seedCurriculum();
    bookOne = await bookIdByNumber(1);
    sessionOne = await sessionIdByNumber(bookOne, 1);
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

  describe("materializeSchedule", () => {
    it("generates proposed meetings 8 weeks out from each live group's schedule", async () => {
      await materializeSchedule(TEST_OWNER, "2026-08-23"); // a Sunday

      // 8 Sundays starting today: 8/23, 8/30, 9/6, 9/13, 9/20, 9/27, 10/4, 10/11
      const meetings = await getCalendar(TEST_OWNER, { from: "2026-08-23", to: "2026-10-18" });
      const generated = meetings.filter((m) => m.origin === "generated" && m.status === "proposed");
      expect(generated).toHaveLength(8);
      expect(generated.map((m) => m.date)).toEqual([
        "2026-08-23",
        "2026-08-30",
        "2026-09-06",
        "2026-09-13",
        "2026-09-20",
        "2026-09-27",
        "2026-10-04",
        "2026-10-11",
      ]);
    });

    it("stamps the leader as led_by and owner (#32)", async () => {
      await materializeSchedule(TEST_OWNER, "2026-08-23");

      const meetings = await getCalendar(TEST_OWNER, { from: "2026-08-23", to: "2026-08-23" });
      expect(meetings[0].ledBy).toBe(TEST_OWNER);
      expect(meetings[0].origin).toBe("generated");
    });

    it("is idempotent — double-materialise produces no duplicates (#73)", async () => {
      await materializeSchedule(TEST_OWNER, "2026-08-23");
      await materializeSchedule(TEST_OWNER, "2026-08-23");

      const meetings = await getCalendar(TEST_OWNER, { from: "2026-08-23", to: "2026-10-18" });
      const generated = meetings.filter((m) => m.origin === "generated");
      expect(generated).toHaveLength(8);
    });

    it("does not materialise meetings that already exist on that date", async () => {
      await materializeSchedule(TEST_OWNER, "2026-08-23");

      // A past-due resolution marks the generated meeting as held — the real
      // flow, not addHeldMeeting which creates a second row.
      await resolveMeeting(TEST_OWNER, group, "2026-08-23", "held");

      await materializeSchedule(TEST_OWNER, "2026-08-23");

      const meetings = await getCalendar(TEST_OWNER, { from: "2026-08-23", to: "2026-08-23" });
      expect(meetings).toHaveLength(1);
      expect(meetings[0].status).toBe("held");
    });

    it("does not touch already-cancelled meetings", async () => {
      await materializeSchedule(TEST_OWNER, "2026-08-23");
      await cancelMeeting(TEST_OWNER, group, "2026-08-30");

      await materializeSchedule(TEST_OWNER, "2026-08-23");

      const meetings = await getCalendar(TEST_OWNER, { from: "2026-08-23", to: "2026-10-18" });
      const cancelled = meetings.find((m) => m.date === "2026-08-30");
      expect(cancelled?.status).toBe("cancelled");
      // And still only one row on that date
      const sameDate = meetings.filter((m) => m.date === "2026-08-30");
      expect(sameDate).toHaveLength(1);
    });

    it("does not materialise for archived groups (#60)", async () => {
      const { archiveGroup } = await import("../roster/groups");
      await archiveGroup(TEST_OWNER, group);

      await materializeSchedule(TEST_OWNER, "2026-08-23");

      const meetings = await getCalendar(TEST_OWNER, { from: "2026-08-23", to: "2026-10-18" });
      expect(meetings).toHaveLength(0);
    });

    it("does not materialise for someone else's groups (#32)", async () => {
      await createGroup("someone.else@example.com", {
        name: "Their Group",
        weekday: 0,
        startTime: "16:00",
        durationMinutes: 90,
        currentBookId: bookOne,
      });

      await materializeSchedule(TEST_OWNER, "2026-08-23");

      const meetings = await getCalendar(TEST_OWNER, { from: "2026-08-23", to: "2026-10-18" });
      expect(meetings).toHaveLength(8); // only the one group's meetings
    });

    it("leaves a human-created meeting on the same day intact", async () => {
      await materializeSchedule(TEST_OWNER, "2026-08-23");

      // A human-created make-up meeting on the same day as a generated one
      await createMeeting(TEST_OWNER, {
        groupId: group,
        date: "2026-08-23",
        startTime: null,
        durationMinutes: null,
        bookId: bookOne,
        sessionId: sessionOne,
        notes: null,
        repeatWeekly: false,
      });

      const meetings = await getCalendar(TEST_OWNER, { from: "2026-08-23", to: "2026-08-30" });
      const sameDate = meetings.filter((m) => m.date === "2026-08-23");
      expect(sameDate).toHaveLength(2);
      expect(sameDate.map((m) => m.origin)).toContain("generated");
      expect(sameDate.map((m) => m.origin)).toContain("created");
    });
  });

  describe("getCalendar", () => {
    it("returns meetings in date order within the range", async () => {
      await materializeSchedule(TEST_OWNER, "2026-08-23");

      const meetings = await getCalendar(TEST_OWNER, {
        from: "2026-08-23",
        to: "2026-09-13",
      });

      expect(meetings.map((m) => m.date)).toEqual([
        "2026-08-23",
        "2026-08-30",
        "2026-09-06",
        "2026-09-13",
      ]);
    });

    it("carries the group name, schedule and book for rendering (#36/#53)", async () => {
      await materializeSchedule(TEST_OWNER, "2026-08-23");

      const meetings = await getCalendar(TEST_OWNER, { from: "2026-08-23", to: "2026-08-23" });
      const entry = meetings[0];

      expect(entry.groupName).toBe("BGroup Linggo");
      expect(entry.weekday).toBe(0);
      expect(entry.startTime).toBe("16:00:00");
      expect(entry.durationMinutes).toBe(90);
    });

    it("is owner-scoped (#32)", async () => {
      await materializeSchedule(TEST_OWNER, "2026-08-23");

      const meetings = await getCalendar("someone.else@example.com", {
        from: "2026-08-23",
        to: "2026-10-18",
      });
      expect(meetings).toHaveLength(0);
    });
  });

  describe("resolveMeeting (past-due one-tap resolve, #52)", () => {
    it("marks a past-due proposed meeting as held", async () => {
      await materializeSchedule(TEST_OWNER, "2026-08-23");

      await resolveMeeting(TEST_OWNER, group, "2026-08-23", "held");

      const meetings = await getCalendar(TEST_OWNER, { from: "2026-08-23", to: "2026-08-23" });
      expect(meetings[0].status).toBe("held");
    });

    it("marks a past-due proposed meeting as cancelled", async () => {
      await materializeSchedule(TEST_OWNER, "2026-08-23");

      await resolveMeeting(TEST_OWNER, group, "2026-08-23", "cancelled");

      const meetings = await getCalendar(TEST_OWNER, { from: "2026-08-23", to: "2026-08-23" });
      expect(meetings[0].status).toBe("cancelled");
    });

    it("does not touch a meeting that is already held or cancelled", async () => {
      await materializeSchedule(TEST_OWNER, "2026-08-23");
      await resolveMeeting(TEST_OWNER, group, "2026-08-23", "held");

      // Resolving an already-held meeting again is a no-op, not an error
      await resolveMeeting(TEST_OWNER, group, "2026-08-23", "held");
      const meetings = await getCalendar(TEST_OWNER, { from: "2026-08-23", to: "2026-08-23" });
      expect(meetings[0].status).toBe("held");
    });

    it("does not resolve a future meeting", async () => {
      await materializeSchedule(TEST_OWNER, "2026-08-23");

      await expect(resolveMeeting(TEST_OWNER, group, "2026-10-11", "held")).rejects.toThrow();
    });

    it("is owner-scoped (#32)", async () => {
      await materializeSchedule(TEST_OWNER, "2026-08-23");

      await expect(
        resolveMeeting("someone.else@example.com", group, "2026-08-23", "held"),
      ).rejects.toThrow();
    });
  });

  describe("cancelMeeting", () => {
    it("cancels a meeting so it shows greyed and struck-through (#50)", async () => {
      await materializeSchedule(TEST_OWNER, "2026-08-23");

      await cancelMeeting(TEST_OWNER, group, "2026-08-30");

      const meetings = await getCalendar(TEST_OWNER, { from: "2026-08-23", to: "2026-10-18" });
      const cancelled = meetings.find((m) => m.date === "2026-08-30");
      expect(cancelled?.status).toBe("cancelled");
    });

    it("does not cancel a meeting that is already held", async () => {
      await materializeSchedule(TEST_OWNER, "2026-08-23");
      // Hold the generated meeting via resolveMeeting (the real flow)
      await resolveMeeting(TEST_OWNER, group, "2026-08-23", "held");

      await expect(cancelMeeting(TEST_OWNER, group, "2026-08-23")).rejects.toThrow();
    });

    it("is owner-scoped (#32)", async () => {
      await materializeSchedule(TEST_OWNER, "2026-08-23");

      await expect(
        cancelMeeting("someone.else@example.com", group, "2026-08-30"),
      ).rejects.toThrow();
    });
  });

  describe("shiftProposedMeetings (schedule change, #48b/#24)", () => {
    it("moves future proposed meetings to the new weekday", async () => {
      await materializeSchedule(TEST_OWNER, "2026-08-23");

      // Group moves from Sunday (0) to Tuesday (2)
      await changeScheduleAndShift(TEST_OWNER, group, 2, "16:00", 90);

      const meetings = await getCalendar(TEST_OWNER, { from: "2026-08-23", to: "2026-10-18" });
      const future = meetings.filter((m) => m.status === "proposed");
      // All remaining proposed meetings should now be on Tuesdays
      expect(future.every((m) => m.weekday === 2)).toBe(true);
    });

    it("does not move held meetings", async () => {
      await materializeSchedule(TEST_OWNER, "2026-08-23");
      // Hold the first one via resolveMeeting (the real flow)
      await resolveMeeting(TEST_OWNER, group, "2026-08-23", "held");

      await changeScheduleAndShift(TEST_OWNER, group, 2, "16:00", 90);

      const meetings = await getCalendar(TEST_OWNER, { from: "2026-08-23", to: "2026-08-30" });
      const august23 = meetings.find((m) => m.date === "2026-08-23");
      expect(august23?.status).toBe("held");
      expect(august23?.weekday).toBe(0); // still Sunday — the old schedule
    });

    it("does not move cancelled meetings", async () => {
      await materializeSchedule(TEST_OWNER, "2026-08-23");
      await cancelMeeting(TEST_OWNER, group, "2026-08-30");

      await changeScheduleAndShift(TEST_OWNER, group, 2, "16:00", 90);

      const meetings = await getCalendar(TEST_OWNER, { from: "2026-08-23", to: "2026-09-12" });
      const august30 = meetings.find((m) => m.date === "2026-08-30");
      expect(august30?.status).toBe("cancelled");
      // The cancelled meeting stays on its original Sunday date
      expect(august30?.weekday).toBe(0);
    });

    it("re-materialises on the new schedule to keep 8 weeks of proposed ahead", async () => {
      await materializeSchedule(TEST_OWNER, "2026-08-23");

      await changeScheduleAndShift(TEST_OWNER, group, 2, "16:00", 90);
      await materializeSchedule(TEST_OWNER, "2026-08-25"); // next Tuesday after shift

      const meetings = await getCalendar(TEST_OWNER, { from: "2026-08-23", to: "2026-10-20" });
      const proposed = meetings.filter((m) => m.status === "proposed");
      expect(proposed).toHaveLength(8);
    });
  });
});

/**
 * Helper: change a group's schedule AND shift future proposed meetings, in one
 * call — the way issue 4's `setGroupSchedule` will need to work once issue 5
 * exists. The test drives the two pieces directly.
 */
async function changeScheduleAndShift(
  ownerId: string,
  groupId: string,
  weekday: number,
  startTime: string,
  durationMinutes: number,
): Promise<void> {
  const { setGroupSchedule } = await import("./meetings");
  await setGroupSchedule(ownerId, groupId, { weekday, startTime, durationMinutes });
  await shiftProposedMeetings(ownerId, groupId, weekday, startTime, durationMinutes);
  await materializeSchedule(ownerId, "2026-08-23");
}
