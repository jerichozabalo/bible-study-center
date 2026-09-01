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
import { seedCurriculum } from "../curriculum/seed";
import { archiveGroup, createGroup } from "../roster/groups";
import { createPerson, removePerson, setSteppedAway } from "../roster/people";
import {
  getGroupReport,
  getPersonReport,
  getRollup,
  groupReportToCsv,
  personReportToCsv,
  rollupToCsv,
} from "./reports";

/**
 * The three Reports derivations (#21) and their CSV Export, at the query
 * boundary the route handler and the Reports screen both read from.
 *
 * They compose the issue 8/9 progress + quiet derivations rather than
 * re-deriving them, and honour #31: a guest visit credits the person, the host
 * group's history shows it, and no home-group or roll-up count moves.
 */
describe.skipIf(!dbConfigured)("reports", () => {
  let bookOne: string;
  let s: string[];

  beforeAll(async () => {
    await ensureSchema();
    await seedCurriculum();
    bookOne = await bookIdByNumber(1);
    s = await Promise.all([1, 2, 3, 4, 5, 6].map((n) => sessionIdByNumber(bookOne, n)));
  });

  beforeEach(async () => {
    await resetMeetings();
    await resetRoster();
  });

  async function tick(
    meetingId: string,
    personId: string,
    mark: "attended" | "present-only" = "attended",
  ): Promise<void> {
    await recordSheet(TEST_OWNER, { meetingId, marks: [{ personId, mark }], hold: true });
  }

  describe("getPersonReport", () => {
    let tuesday: string;
    let saturday: string;
    let maria: string;

    beforeEach(async () => {
      tuesday = await createGroup(TEST_OWNER, {
        name: "Tuesday BGroup",
        weekday: 2,
        startTime: "19:00",
        durationMinutes: 90,
        currentBookId: bookOne,
      });
      saturday = await createGroup(TEST_OWNER, {
        name: "Saturday BGroup",
        weekday: 6,
        startTime: "16:00",
        durationMinutes: 90,
        currentBookId: bookOne,
      });
      maria = await createPerson(TEST_OWNER, {
        name: "Maria Santos",
        homeGroupId: tuesday,
        joinedOn: "2026-06-01",
        phone: "0917 555 0184",
        email: "maria@example.com",
        spiritualStatus: "Edify",
        baptized: true,
        baptizedOn: "2026-05-04",
      });
    });

    it("carries contact, per-book progress, and every non-cancelled meeting attended", async () => {
      const m1 = await addHeldMeeting(TEST_OWNER, tuesday, "2026-06-02", {
        bookId: bookOne,
        sessionId: s[0],
      });
      const m2 = await addHeldMeeting(TEST_OWNER, tuesday, "2026-06-09", {
        bookId: bookOne,
        sessionId: s[1],
      });
      const fellowship = await addHeldMeeting(TEST_OWNER, tuesday, "2026-06-16", {
        bookId: null,
        sessionId: null,
      });
      // A ride-along at another BGroup (#31) — credits her, shows as a guest visit.
      const visit = await addHeldMeeting(TEST_OWNER, saturday, "2026-06-13", {
        bookId: bookOne,
        sessionId: s[2],
      });
      await tick(m1, maria);
      await tick(m2, maria);
      await tick(fellowship, maria, "present-only");
      await tick(visit, maria);

      const report = await getPersonReport(TEST_OWNER, maria);

      expect(report).not.toBeNull();
      expect(report!.person).toMatchObject({
        name: "Maria Santos",
        homeGroupName: "Tuesday BGroup",
        spiritualStatus: "Edify",
        baptized: true,
        baptizedOn: "2026-05-04",
      });
      expect(report!.progress.find((b) => b.bookNumber === 1)!.coveredCount).toBe(3);
      expect(report!.attendance).toEqual([
        {
          date: "2026-06-16",
          groupName: "Tuesday BGroup",
          guest: false,
          coverage: "Fellowship night",
          mark: "present-only",
        },
        {
          date: "2026-06-13",
          groupName: "Saturday BGroup",
          guest: true,
          coverage: "Session 3 — One Proof — Our New Life in Christ",
          mark: "attended",
        },
        {
          date: "2026-06-09",
          groupName: "Tuesday BGroup",
          guest: false,
          coverage: "Session 2 — One Way — The Savior",
          mark: "attended",
        },
        {
          date: "2026-06-02",
          groupName: "Tuesday BGroup",
          guest: false,
          coverage: "Session 1 — One Truth — The Gospel",
          mark: "attended",
        },
      ]);
    });

    it("is null for a removed person — a tombstone is history, not roster data (#24)", async () => {
      await removePerson(TEST_OWNER, maria);
      expect(await getPersonReport(TEST_OWNER, maria)).toBeNull();
    });
  });

  describe("getGroupReport", () => {
    let tuesday: string;
    let saturday: string;

    beforeEach(async () => {
      tuesday = await createGroup(TEST_OWNER, {
        name: "Tuesday BGroup",
        weekday: 2,
        startTime: "19:00",
        durationMinutes: 90,
        currentBookId: bookOne,
      });
      saturday = await createGroup(TEST_OWNER, {
        name: "Saturday BGroup",
        weekday: 6,
        startTime: "16:00",
        durationMinutes: 90,
        currentBookId: bookOne,
      });
    });

    it("lists held + cancelled meetings with attendance, guests (#31), and the book roll-up", async () => {
      const ben = await createPerson(TEST_OWNER, {
        name: "Ben Cruz",
        homeGroupId: tuesday,
        joinedOn: "2026-06-01",
      });
      const maria = await createPerson(TEST_OWNER, {
        name: "Maria Santos",
        homeGroupId: tuesday,
        joinedOn: "2026-06-01",
      });
      const nico = await createPerson(TEST_OWNER, {
        name: "Nico Dela Cruz",
        homeGroupId: saturday,
        joinedOn: "2026-06-01",
      });

      const m1 = await addHeldMeeting(TEST_OWNER, tuesday, "2026-06-02", {
        bookId: bookOne,
        sessionId: s[0],
      });
      const m2 = await addHeldMeeting(TEST_OWNER, tuesday, "2026-06-09", {
        bookId: bookOne,
        sessionId: s[1],
      });
      await addCancelledMeeting(TEST_OWNER, tuesday, "2026-06-16");
      // A future proposed night is not history — it must not appear.
      await addGeneratedMeeting(TEST_OWNER, tuesday, "2026-06-23");

      await tick(m1, ben);
      await tick(m1, maria);
      await tick(m2, maria);
      await tick(m2, nico); // guest — home group is Saturday

      const report = await getGroupReport(TEST_OWNER, tuesday);

      expect(report).not.toBeNull();
      expect(report!.heldCount).toBe(2);
      expect(report!.cancelledCount).toBe(1);
      expect(report!.meetings.map((m) => m.date)).toEqual([
        "2026-06-16",
        "2026-06-09",
        "2026-06-02",
      ]);

      const jun9 = report!.meetings.find((m) => m.date === "2026-06-09")!;
      expect(jun9).toMatchObject({
        status: "held",
        coverage: "Session 2 — One Way — The Savior",
        attendeeCount: 2,
      });
      expect(jun9.guests).toEqual([{ name: "Nico Dela Cruz", homeGroupName: "Saturday BGroup" }]);

      const jun16 = report!.meetings.find((m) => m.date === "2026-06-16")!;
      expect(jun16).toMatchObject({
        status: "cancelled",
        coverage: "Cancelled",
        attendeeCount: 0,
        guests: [],
      });

      // #31 — the visit credits Nico, but it does not add him to this group's
      // roll-up: only its own members are counted.
      expect(report!.bookProgress!.members.map((m) => m.name)).toEqual([
        "Ben Cruz",
        "Maria Santos",
      ]);
    });
  });

  describe("getRollup", () => {
    it("credits a guest visit to the person; a stepped-away member counts as stepped away, not quiet", async () => {
      const tuesday = await createGroup(TEST_OWNER, {
        name: "Tuesday BGroup",
        weekday: 2,
        startTime: "19:00",
        durationMinutes: 90,
        currentBookId: bookOne,
      });
      const saturday = await createGroup(TEST_OWNER, {
        name: "Saturday BGroup",
        weekday: 6,
        startTime: "16:00",
        durationMinutes: 90,
        currentBookId: bookOne,
      });

      const maria = await createPerson(TEST_OWNER, {
        name: "Maria Santos",
        homeGroupId: tuesday,
        joinedOn: "2026-06-01",
      });
      const ben = await createPerson(TEST_OWNER, {
        name: "Ben Cruz",
        homeGroupId: tuesday,
        joinedOn: "2026-06-01",
      });
      const nico = await createPerson(TEST_OWNER, {
        name: "Nico Dela Cruz",
        homeGroupId: saturday,
        joinedOn: "2026-06-01",
      });

      await setSteppedAway(TEST_OWNER, ben, true);

      // Nico covers 5 sessions at his own BGroup and the 6th as a guest at
      // Tuesday — a complete book 1, part of it earned on a ride-along.
      const satDates = ["2026-06-06", "2026-06-13", "2026-06-20", "2026-06-27", "2026-07-04"];
      for (let i = 0; i < 5; i++) {
        const meeting = await addHeldMeeting(TEST_OWNER, saturday, satDates[i], {
          bookId: bookOne,
          sessionId: s[i],
        });
        await tick(meeting, nico);
      }
      const guestNight = await addHeldMeeting(TEST_OWNER, tuesday, "2026-06-30", {
        bookId: bookOne,
        sessionId: s[5],
      });
      await tick(guestNight, nico);

      // Maria covers only two — not a completed book, and not quiet.
      const t1 = await addHeldMeeting(TEST_OWNER, tuesday, "2026-06-02", {
        bookId: bookOne,
        sessionId: s[0],
      });
      const t2 = await addHeldMeeting(TEST_OWNER, tuesday, "2026-06-09", {
        bookId: bookOne,
        sessionId: s[1],
      });
      await tick(t1, maria);
      await tick(t2, maria);

      const rollup = await getRollup(TEST_OWNER);

      expect(rollup.members).toBe(3);
      expect(rollup.activeGroups).toBe(2);
      expect(rollup.archivedGroups).toBe(0);
      expect(rollup.steppedAway).toBe(1);
      expect(rollup.quiet).toBe(0);
      expect(rollup.baptized).toBe(0);

      const book1 = rollup.books.find((b) => b.bookNumber === 1)!;
      expect(book1.completedCount).toBe(1);
      expect(rollup.books.filter((b) => b.completedCount > 0)).toHaveLength(1);
    });
  });

  describe("CSV Export golden files", () => {
    it("person sheet", async () => {
      const tuesday = await createGroup(TEST_OWNER, {
        name: "Tuesday BGroup",
        weekday: 2,
        startTime: "19:00",
        durationMinutes: 90,
        currentBookId: bookOne,
      });
      const maria = await createPerson(TEST_OWNER, {
        name: "Maria Santos",
        homeGroupId: tuesday,
        joinedOn: "2026-06-01",
        phone: "0917 555 0184",
        email: "maria@example.com",
        spiritualStatus: "Edify",
        baptized: true,
        baptizedOn: "2026-05-04",
        birthday: "1994-03-14",
        address: "12 Rizal St",
        civilStatus: "Single",
        invitedBy: "Ana",
      });

      const m1 = await addHeldMeeting(TEST_OWNER, tuesday, "2026-06-02", {
        bookId: bookOne,
        sessionId: s[0],
      });
      const fellowship = await addHeldMeeting(TEST_OWNER, tuesday, "2026-06-09", {
        bookId: null,
        sessionId: null,
      });
      await tick(m1, maria);
      await tick(fellowship, maria, "present-only");

      const report = await getPersonReport(TEST_OWNER, maria);

      expect(personReportToCsv(report!)).toBe(
        [
          "Person sheet,Maria Santos",
          "Home BGroup,Tuesday BGroup",
          "Spiritual status,Edify",
          "Baptized,2026-05-04",
          "Joined,2026-06-01",
          "Birthday,1994-03-14",
          "Address,12 Rizal St",
          "Civil status,Single",
          "Invited by,Ana",
          "Phone,0917 555 0184",
          "Email,maria@example.com",
          "Stepped away,",
          "",
          "Progress",
          "Book,Sessions covered,Complete",
          "Book 1 — One By One,1 of 6,No",
          "Book 2 — Spiritual Disciplines,0 of 6,No",
          "Book 3 — The Holy Spirit,0 of 4,No",
          "Book 4 — CCF DNA,0 of 4,No",
          "Book 5 — Starting Point for Small Groups / DGroup 101,0 of 4,No",
          "Book 6 — Basic Doctrines,0 of 6,No",
          "Book 7 — Family Life,0 of 8,No",
          "Book 8 — Bible Survey,0 of 12,No",
          "",
          "Attendance",
          "Date,BGroup,Guest visit,Coverage,Mark",
          "2026-06-09,Tuesday BGroup,No,Fellowship night,Present only",
          "2026-06-02,Tuesday BGroup,No,Session 1 — One Truth — The Gospel,Attended",
        ].join("\r\n"),
      );
    });

    it("group history", async () => {
      const tuesday = await createGroup(TEST_OWNER, {
        name: "Tuesday BGroup",
        weekday: 2,
        startTime: "19:00",
        durationMinutes: 90,
        currentBookId: bookOne,
      });
      const saturday = await createGroup(TEST_OWNER, {
        name: "Saturday BGroup",
        weekday: 6,
        startTime: "16:00",
        durationMinutes: 90,
        currentBookId: bookOne,
      });
      const ben = await createPerson(TEST_OWNER, {
        name: "Ben Cruz",
        homeGroupId: tuesday,
        joinedOn: "2026-06-01",
      });
      const maria = await createPerson(TEST_OWNER, {
        name: "Maria Santos",
        homeGroupId: tuesday,
        joinedOn: "2026-06-01",
      });
      const nico = await createPerson(TEST_OWNER, {
        name: "Nico Dela Cruz",
        homeGroupId: saturday,
        joinedOn: "2026-06-01",
      });

      const m1 = await addHeldMeeting(TEST_OWNER, tuesday, "2026-06-02", {
        bookId: bookOne,
        sessionId: s[0],
      });
      const m2 = await addHeldMeeting(TEST_OWNER, tuesday, "2026-06-09", {
        bookId: bookOne,
        sessionId: s[1],
      });
      await addCancelledMeeting(TEST_OWNER, tuesday, "2026-06-16");
      await tick(m1, ben);
      await tick(m1, maria);
      await tick(m2, maria);
      await tick(m2, nico);

      const report = await getGroupReport(TEST_OWNER, tuesday);

      expect(groupReportToCsv(report!)).toBe(
        [
          "Group history,Tuesday BGroup",
          "Schedule,Tuesdays 7:00 PM · 1 hr 30 min",
          "Current book,Book 1 — One By One",
          "Held,2",
          "Cancelled,1",
          "",
          "Meetings",
          "Date,Status,Coverage,Attendance,Guests,Notes",
          "2026-06-16,Cancelled,Cancelled,,,",
          "2026-06-09,Held,Session 2 — One Way — The Savior,2,Nico Dela Cruz (Saturday BGroup),",
          "2026-06-02,Held,Session 1 — One Truth — The Gospel,2,,",
          "",
          "Book progress",
          "Member,Sessions covered,Complete",
          "Ben Cruz,1 of 6,No",
          "Maria Santos,2 of 6,No",
        ].join("\r\n"),
      );
    });

    it("roll-up", async () => {
      const tuesday = await createGroup(TEST_OWNER, {
        name: "Tuesday BGroup",
        weekday: 2,
        startTime: "19:00",
        durationMinutes: 90,
        currentBookId: bookOne,
      });
      await createGroup(TEST_OWNER, {
        name: "Saturday BGroup",
        weekday: 6,
        startTime: "16:00",
        durationMinutes: 90,
        currentBookId: bookOne,
      });
      const old = await createGroup(TEST_OWNER, {
        name: "Old BGroup",
        weekday: 1,
        startTime: "19:00",
        durationMinutes: 90,
        currentBookId: null,
      });
      await archiveGroup(TEST_OWNER, old);

      const maria = await createPerson(TEST_OWNER, {
        name: "Maria Santos",
        homeGroupId: tuesday,
        joinedOn: "2026-06-01",
        baptized: true,
        baptizedOn: "2026-05-04",
      });
      const ben = await createPerson(TEST_OWNER, {
        name: "Ben Cruz",
        homeGroupId: tuesday,
        joinedOn: "2026-06-01",
      });
      await createPerson(TEST_OWNER, {
        name: "Nico Dela Cruz",
        homeGroupId: null,
        joinedOn: "2026-06-01",
      });
      await setSteppedAway(TEST_OWNER, ben, true);

      const dates = [
        "2026-06-02",
        "2026-06-09",
        "2026-06-16",
        "2026-06-23",
        "2026-06-30",
        "2026-07-07",
      ];
      for (let i = 0; i < 6; i++) {
        const meeting = await addHeldMeeting(TEST_OWNER, tuesday, dates[i], {
          bookId: bookOne,
          sessionId: s[i],
        });
        await tick(meeting, maria);
      }

      const rollup = await getRollup(TEST_OWNER);

      expect(rollupToCsv(rollup)).toBe(
        [
          "Roll-up",
          "Members,3",
          "Active BGroups,2",
          "Archived BGroups,1",
          "Quiet,0",
          "Baptized,1",
          "Stepped away,1",
          "",
          "Books completed",
          "Book,Members completed",
          "Book 1 — One By One,1",
          "Book 2 — Spiritual Disciplines,0",
          "Book 3 — The Holy Spirit,0",
          "Book 4 — CCF DNA,0",
          "Book 5 — Starting Point for Small Groups / DGroup 101,0",
          "Book 6 — Basic Doctrines,0",
          "Book 7 — Family Life,0",
          "Book 8 — Bible Survey,0",
        ].join("\r\n"),
      );
    });
  });
});
