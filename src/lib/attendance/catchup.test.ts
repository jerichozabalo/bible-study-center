import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  TEST_OWNER,
  bookIdByNumber,
  dbConfigured,
  ensureSchema,
  resetRoster,
} from "../../../tests/fixtures";
import { addHeldMeeting, resetMeetings, sessionIdByNumber } from "../../../tests/meeting-fixtures";
import { seedCurriculum } from "../curriculum/seed";
import { cancelMeeting } from "../meetings/calendar";
import { createMeeting } from "../meetings/meetings";
import { createGroup } from "../roster/groups";
import { createPerson, removePerson, setSteppedAway } from "../roster/people";
import { getCatchUpCandidates, getCatchUpTargets } from "./catchup";
import { listCompletions, listCoveredSessions, recordSheet } from "./completions";

/**
 * Catch-up matching (#31), both directions, over two BGroups on the same book
 * at different points in it.
 */
describe.skipIf(!dbConfigured)("catch-up matching", () => {
  let bookOne: string;
  let bookTwo: string;
  let sessionThree: string;
  let sessionFour: string;
  let bookTwoSessionOne: string;

  let martes: string;
  let linggo: string;
  let maria: string;
  let ana: string;
  let nico: string;
  /** BGroup Martes, session 4 of Book 1 — the night the sheet is open on. */
  let meeting: string;

  beforeAll(async () => {
    await ensureSchema();
    await seedCurriculum();
    bookOne = await bookIdByNumber(1);
    bookTwo = await bookIdByNumber(2);
    sessionThree = await sessionIdByNumber(bookOne, 3);
    sessionFour = await sessionIdByNumber(bookOne, 4);
    bookTwoSessionOne = await sessionIdByNumber(bookTwo, 1);
  });

  beforeEach(async () => {
    await resetMeetings();
    await resetRoster();

    martes = await createGroup(TEST_OWNER, {
      name: "BGroup Martes",
      weekday: 2,
      startTime: "19:00",
      durationMinutes: 90,
      currentBookId: bookOne,
    });
    linggo = await createGroup(TEST_OWNER, {
      name: "BGroup Linggo",
      weekday: 0,
      startTime: "16:00",
      durationMinutes: 90,
      currentBookId: bookOne,
    });

    maria = await createPerson(TEST_OWNER, { name: "Maria Santos", homeGroupId: martes });
    ana = await createPerson(TEST_OWNER, { name: "Ana Reyes", homeGroupId: linggo });
    nico = await createPerson(TEST_OWNER, {
      name: "Nico Bautista",
      homeGroupId: linggo,
      joinedOn: "2026-07-05",
    });

    meeting = await createMeeting(TEST_OWNER, {
      groupId: martes,
      date: "2026-08-25",
      startTime: null,
      durationMinutes: null,
      bookId: bookOne,
      sessionId: sessionFour,
      notes: null,
      repeatWeekly: false,
    });
  });

  describe("getCatchUpCandidates — who could ride along tonight", () => {
    it("lists people from OTHER BGroups missing that exact session (#31)", async () => {
      expect(await getCatchUpCandidates(TEST_OWNER, meeting)).toMatchObject([
        { personId: ana, name: "Ana Reyes", homeGroupId: linggo, homeGroupName: "BGroup Linggo" },
        { personId: nico, name: "Nico Bautista", homeGroupName: "BGroup Linggo" },
      ]);
    });

    it("drops someone once they have covered it, wherever they covered it", async () => {
      const linggoNight = await addHeldMeeting(TEST_OWNER, linggo, "2026-08-16", {
        bookId: bookOne,
        sessionId: sessionFour,
      });
      await recordSheet(TEST_OWNER, {
        meetingId: linggoNight,
        marks: [{ personId: ana, mark: "attended" }],
        hold: true,
      });

      expect(await getCatchUpCandidates(TEST_OWNER, meeting)).toMatchObject([{ personId: nico }]);
    });

    it("does not count a night that was called off (#50)", async () => {
      const called = await createMeeting(TEST_OWNER, {
        groupId: linggo,
        date: "2026-08-16",
        startTime: null,
        durationMinutes: null,
        bookId: bookOne,
        sessionId: sessionFour,
        notes: null,
        repeatWeekly: false,
      });
      await recordSheet(TEST_OWNER, {
        meetingId: called,
        marks: [{ personId: ana, mark: "attended" }],
        hold: false,
      });
      await cancelMeeting(TEST_OWNER, linggo, "2026-08-16");

      expect(await getCatchUpCandidates(TEST_OWNER, meeting)).toMatchObject([
        { personId: ana },
        { personId: nico },
      ]);
    });

    it("does not count being in the room without the lesson (#25)", async () => {
      const linggoNight = await addHeldMeeting(TEST_OWNER, linggo, "2026-08-16", {
        bookId: bookOne,
        sessionId: sessionFour,
      });
      await recordSheet(TEST_OWNER, {
        meetingId: linggoNight,
        marks: [{ personId: ana, mark: "present-only" }],
        hold: true,
      });

      expect(await getCatchUpCandidates(TEST_OWNER, meeting)).toMatchObject([
        { personId: ana },
        { personId: nico },
      ]);
    });

    it("leaves out anyone this sheet already records", async () => {
      await recordSheet(TEST_OWNER, {
        meetingId: meeting,
        marks: [{ personId: ana, mark: "attended" }],
        hold: false,
      });

      expect(await getCatchUpCandidates(TEST_OWNER, meeting)).toMatchObject([{ personId: nico }]);
    });

    it("leaves out people who are off the roster or stepped away (#24/#10)", async () => {
      await removePerson(TEST_OWNER, ana);
      await setSteppedAway(TEST_OWNER, nico, true);

      expect(await getCatchUpCandidates(TEST_OWNER, meeting)).toEqual([]);
    });

    it("carries the joined-at marker, so a mid-book joiner reads in context (#28)", async () => {
      expect(await getCatchUpCandidates(TEST_OWNER, meeting)).toMatchObject([
        { personId: ana },
        {
          personId: nico,
          joinedOn: "2026-07-05",
          joinedAtBookNumber: 1,
          joinedAtBookTitle: "One By One",
        },
      ]);
    });

    it("has nobody to offer on a fellowship night (#26)", async () => {
      const fellowship = await createMeeting(TEST_OWNER, {
        groupId: martes,
        date: "2026-09-01",
        startTime: null,
        durationMinutes: null,
        bookId: null,
        sessionId: null,
        notes: null,
        repeatWeekly: false,
      });

      expect(await getCatchUpCandidates(TEST_OWNER, fellowship)).toEqual([]);
    });

    it("is nothing to another leader, or for an id that is not a meeting (#32)", async () => {
      expect(await getCatchUpCandidates("someone.else@example.com", meeting)).toEqual([]);
      expect(await getCatchUpCandidates(TEST_OWNER, "not-a-meeting")).toEqual([]);
    });

    /**
     * The counting rule (#31): the completion credits the PERSON. Riding along
     * at BGroup Martes is what takes Nico off BGroup Linggo's own catch-up list
     * for that session — and the host's night is where the visit shows.
     */
    it("credits the person, not the group they visited (#31)", async () => {
      await recordSheet(TEST_OWNER, {
        meetingId: meeting,
        marks: [{ personId: nico, mark: "attended" }],
        hold: true,
      });
      const linggoNight = await createMeeting(TEST_OWNER, {
        groupId: linggo,
        date: "2026-08-30",
        startTime: null,
        durationMinutes: null,
        bookId: bookOne,
        sessionId: sessionFour,
        notes: null,
        repeatWeekly: false,
      });

      expect(await getCatchUpCandidates(TEST_OWNER, linggoNight)).toMatchObject([
        { personId: maria },
      ]);
      expect(await listCoveredSessions(TEST_OWNER, nico)).toMatchObject([
        { sessionNumber: 4, meetingId: meeting },
      ]);
      // The host BGroup's own history shows the visit (#31).
      expect(await listCompletions(TEST_OWNER, meeting)).toMatchObject([
        { personId: nico, personName: "Nico Bautista", sessionId: sessionFour },
      ]);
    });
  });

  describe("getCatchUpTargets — the meeting a gap could be filled at", () => {
    it("names an upcoming meeting covering a session they are missing (#31)", async () => {
      const martesThree = await createMeeting(TEST_OWNER, {
        groupId: martes,
        date: "2026-08-18",
        startTime: null,
        durationMinutes: null,
        bookId: bookOne,
        sessionId: sessionThree,
        notes: null,
        repeatWeekly: false,
      });

      expect(await getCatchUpTargets(TEST_OWNER, nico, "2026-08-11")).toMatchObject([
        {
          sessionId: sessionThree,
          sessionNumber: 3,
          bookNumber: 1,
          meetingId: martesThree,
          groupId: martes,
          groupName: "BGroup Martes",
          date: "2026-08-18",
        },
        { sessionId: sessionFour, meetingId: meeting, date: "2026-08-25" },
      ]);
    });

    it("counts today as upcoming and yesterday as gone (#56)", async () => {
      expect(await getCatchUpTargets(TEST_OWNER, nico, "2026-08-25")).toMatchObject([
        { meetingId: meeting },
      ]);
      expect(await getCatchUpTargets(TEST_OWNER, nico, "2026-08-26")).toEqual([]);
    });

    it("names the soonest night that covers a session, once each", async () => {
      const later = await createMeeting(TEST_OWNER, {
        groupId: linggo,
        date: "2026-08-30",
        startTime: null,
        durationMinutes: null,
        bookId: bookOne,
        sessionId: sessionFour,
        notes: null,
        repeatWeekly: false,
      });

      expect(await getCatchUpTargets(TEST_OWNER, nico, "2026-08-11")).toMatchObject([
        { sessionId: sessionFour, meetingId: meeting },
      ]);
      expect(later).not.toBe(meeting);
    });

    it("leaves out a night that already happened or was called off (#47/#50)", async () => {
      await cancelMeeting(TEST_OWNER, martes, "2026-08-25");
      const held = await addHeldMeeting(TEST_OWNER, linggo, "2026-08-30", {
        bookId: bookOne,
        sessionId: sessionFour,
      });

      expect(await getCatchUpTargets(TEST_OWNER, nico, "2026-08-11")).toEqual([]);
      expect(held).not.toBe(meeting);
    });

    it("stays inside the book their own BGroup is on (#17)", async () => {
      const aheadOfThem = await createMeeting(TEST_OWNER, {
        groupId: martes,
        date: "2026-09-01",
        startTime: null,
        durationMinutes: null,
        bookId: bookTwo,
        sessionId: bookTwoSessionOne,
        notes: null,
        repeatWeekly: false,
      });

      expect(await getCatchUpTargets(TEST_OWNER, nico, "2026-08-11")).toMatchObject([
        { meetingId: meeting },
      ]);
      expect(aheadOfThem).not.toBe(meeting);
    });

    it("has nothing to say once the gap is filled", async () => {
      await recordSheet(TEST_OWNER, {
        meetingId: meeting,
        marks: [{ personId: nico, mark: "attended" }],
        hold: true,
      });

      expect(await getCatchUpTargets(TEST_OWNER, nico, "2026-08-11")).toEqual([]);
    });

    it("is nothing without a BGroup on a book, or for another leader (#32)", async () => {
      const loose = await createPerson(TEST_OWNER, { name: "Rico Aquino", homeGroupId: null });

      expect(await getCatchUpTargets(TEST_OWNER, loose, "2026-08-11")).toEqual([]);
      expect(await getCatchUpTargets("someone.else@example.com", nico, "2026-08-11")).toEqual([]);
      expect(await getCatchUpTargets(TEST_OWNER, "not-a-person", "2026-08-11")).toEqual([]);
    });
  });
});
