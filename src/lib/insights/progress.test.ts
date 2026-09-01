import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  TEST_OWNER,
  bookIdByNumber,
  dbConfigured,
  ensureSchema,
  resetRoster,
} from "../../../tests/fixtures";
import { addHeldMeeting, resetMeetings, sessionIdByNumber } from "../../../tests/meeting-fixtures";
import { recordSheet } from "../attendance/completions";
import { seedCurriculum } from "../curriculum/seed";
import { cancelMeeting } from "../meetings/calendar";
import { createMeeting } from "../meetings/meetings";
import { createGroup } from "../roster/groups";
import { createPerson } from "../roster/people";
import { getGroupBookProgress, getPersonProgress, leftBehind } from "./progress";

/**
 * Strict book completion (#5) and the progress it draws, at the seam issue 10's
 * report and both screens read from.
 *
 * The scenario is BGroup Martes on Book 1, six sessions, three of them held —
 * and Book 8 alongside it, because twelve sessions is the case no artboard ever
 * drew (#68) and the one strictness has to survive.
 */
describe.skipIf(!dbConfigured)("book progress", () => {
  let bookOne: string;
  let bookEight: string;
  let bookOneSessions: string[];
  let bookEightSessions: string[];

  let martes: string;
  let maria: string;

  beforeAll(async () => {
    await ensureSchema();
    await seedCurriculum();
    bookOne = await bookIdByNumber(1);
    bookEight = await bookIdByNumber(8);
    bookOneSessions = await Promise.all(
      [1, 2, 3, 4, 5, 6].map((number) => sessionIdByNumber(bookOne, number)),
    );
    bookEightSessions = await Promise.all(
      Array.from({ length: 12 }, (_, index) => sessionIdByNumber(bookEight, index + 1)),
    );
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
    maria = await createPerson(TEST_OWNER, {
      name: "Maria Santos",
      homeGroupId: martes,
      joinedOn: "2026-06-01",
    });
  });

  /** One held night covering one session, with everybody named on the sheet. */
  async function cover(
    groupId: string,
    bookId: string,
    sessionId: string,
    date: string,
    personIds: string[],
  ): Promise<string> {
    const meetingId = await addHeldMeeting(TEST_OWNER, groupId, date, { bookId, sessionId });
    if (personIds.length > 0) {
      await recordSheet(TEST_OWNER, {
        meetingId,
        marks: personIds.map((personId) => ({ personId, mark: "attended" as const })),
        hold: true,
      });
    }
    return meetingId;
  }

  function bookOf(books: Awaited<ReturnType<typeof getPersonProgress>>, number: number) {
    const book = books.find((candidate) => candidate.bookNumber === number);
    if (!book) throw new Error(`Book ${number} is not in this person's progress`);
    return book;
  }

  describe("getPersonProgress", () => {
    it("draws every session of every book, covered or not", async () => {
      const books = await getPersonProgress(TEST_OWNER, maria);

      expect(books.map((book) => book.bookNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(bookOf(books, 1).sessions.map((session) => session.number)).toEqual([1, 2, 3, 4, 5, 6]);
      // #68 — the row that no board renders, and the reason the dots wrap.
      expect(bookOf(books, 8).sessions).toHaveLength(12);
      expect(bookOf(books, 1)).toMatchObject({ coveredCount: 0, complete: false });
    });

    it("fills the sessions they covered, with the night they covered them", async () => {
      await cover(martes, bookOne, bookOneSessions[0], "2026-06-02", [maria]);
      await cover(martes, bookOne, bookOneSessions[1], "2026-06-09", [maria]);

      const book = bookOf(await getPersonProgress(TEST_OWNER, maria), 1);

      expect(book.coveredCount).toBe(2);
      expect(book.complete).toBe(false);
      expect(book.sessions.map((session) => session.covered)).toEqual([
        true,
        true,
        false,
        false,
        false,
        false,
      ]);
      expect(book.sessions[0].date).toBe("2026-06-02");
      expect(book.sessions[2].date).toBeNull();
    });

    it("is complete only with ALL twelve sessions of Book 8 (#5/#68)", async () => {
      for (const [index, sessionId] of bookEightSessions.slice(0, 11).entries()) {
        await cover(martes, bookEight, sessionId, `2026-07-${String(index + 1).padStart(2, "0")}`, [
          maria,
        ]);
      }

      const eleven = bookOf(await getPersonProgress(TEST_OWNER, maria), 8);
      expect(eleven).toMatchObject({ coveredCount: 11, sessionCount: 12, complete: false });

      await cover(martes, bookEight, bookEightSessions[11], "2026-07-12", [maria]);

      const twelve = bookOf(await getPersonProgress(TEST_OWNER, maria), 8);
      expect(twelve).toMatchObject({ coveredCount: 12, sessionCount: 12, complete: true });
    });

    it("does not enforce order — a session covered out of turn still counts (#2)", async () => {
      await cover(martes, bookOne, bookOneSessions[4], "2026-06-02", [maria]);

      const book = bookOf(await getPersonProgress(TEST_OWNER, maria), 1);
      expect(book.coveredCount).toBe(1);
      expect(book.sessions[4].covered).toBe(true);
    });

    it("credits a session covered as a ride-along at another BGroup (#31)", async () => {
      const linggo = await createGroup(TEST_OWNER, {
        name: "BGroup Linggo",
        weekday: 0,
        startTime: "16:00",
        durationMinutes: 90,
        currentBookId: bookOne,
      });
      await cover(linggo, bookOne, bookOneSessions[2], "2026-06-07", [maria]);

      const book = bookOf(await getPersonProgress(TEST_OWNER, maria), 1);
      expect(book.coveredCount).toBe(1);
      expect(book.sessions[2].covered).toBe(true);
    });

    it("credits nothing for a row with no session (#65)", async () => {
      // A fellowship night (#26): held, on no session, everybody present.
      const fellowship = await addHeldMeeting(TEST_OWNER, martes, "2026-06-16");
      await recordSheet(TEST_OWNER, {
        meetingId: fellowship,
        marks: [{ personId: maria, mark: "attended" }],
        hold: true,
      });
      // And 'present only' on a night that did cover one (#25).
      const night = await addHeldMeeting(TEST_OWNER, martes, "2026-06-23", {
        bookId: bookOne,
        sessionId: bookOneSessions[0],
      });
      await recordSheet(TEST_OWNER, {
        meetingId: night,
        marks: [{ personId: maria, mark: "present-only" }],
        hold: true,
      });

      expect(bookOf(await getPersonProgress(TEST_OWNER, maria), 1).coveredCount).toBe(0);
    });

    it("credits nothing for a night that was called off (#50)", async () => {
      // Taken, then cancelled: the completion row survives (#24) and stops
      // counting, which is the filter `listCoveredSessions` already applies.
      const night = await createMeeting(TEST_OWNER, {
        groupId: martes,
        date: "2026-06-02",
        startTime: null,
        durationMinutes: null,
        bookId: bookOne,
        sessionId: bookOneSessions[0],
        notes: null,
        repeatWeekly: false,
      });
      await recordSheet(TEST_OWNER, {
        meetingId: night,
        marks: [{ personId: maria, mark: "attended" }],
        hold: false,
      });
      await cancelMeeting(TEST_OWNER, martes, "2026-06-02");

      const book = bookOf(await getPersonProgress(TEST_OWNER, maria), 1);
      expect(book.coveredCount).toBe(0);
      expect(book.sessions[0].covered).toBe(false);
    });

    it("marks what the BGroup covered before they joined it (#28)", async () => {
      const nena = await createPerson(TEST_OWNER, {
        name: "Nena Villamor",
        homeGroupId: martes,
        joinedOn: "2026-06-20",
      });
      await cover(martes, bookOne, bookOneSessions[0], "2026-06-02", [maria]);
      await cover(martes, bookOne, bookOneSessions[1], "2026-06-09", [maria]);
      await cover(martes, bookOne, bookOneSessions[2], "2026-06-30", [maria, nena]);

      const book = bookOf(await getPersonProgress(TEST_OWNER, nena), 1);

      expect(book.sessions.map((session) => session.beforeJoining)).toEqual([
        true,
        true,
        false,
        false,
        false,
        false,
      ]);
      expect(book.joinedAtSessionNumber).toBe(3);
      expect(book.coveredCount).toBe(1);
    });

    it("leaves the marker off someone who was there from the start (#28)", async () => {
      await cover(martes, bookOne, bookOneSessions[0], "2026-06-02", [maria]);

      const book = bookOf(await getPersonProgress(TEST_OWNER, maria), 1);
      expect(book.sessions.every((session) => !session.beforeJoining)).toBe(true);
      expect(book.joinedAtSessionNumber).toBeNull();
    });

    it("is owner-scoped and empty for someone who is not there (#32)", async () => {
      expect(await getPersonProgress("someone-else@example.com", maria)).toEqual([]);
      expect(await getPersonProgress(TEST_OWNER, "not-a-uuid")).toEqual([]);
    });
  });

  describe("getGroupBookProgress", () => {
    let ben: string;
    let nena: string;

    beforeEach(async () => {
      ben = await createPerson(TEST_OWNER, {
        name: "Ben Cruz",
        homeGroupId: martes,
        joinedOn: "2026-06-01",
      });
      nena = await createPerson(TEST_OWNER, {
        name: "Nena Villamor",
        homeGroupId: martes,
        joinedOn: "2026-06-20",
      });
    });

    it("has nothing to say for a BGroup with no book yet (#17)", async () => {
      const bookless = await createGroup(TEST_OWNER, {
        name: "BGroup Bago",
        weekday: 4,
        startTime: "19:00",
        durationMinutes: 90,
        currentBookId: null,
      });

      expect(await getGroupBookProgress(TEST_OWNER, bookless)).toBeNull();
    });

    it("reports what the group has covered on its own held nights", async () => {
      await cover(martes, bookOne, bookOneSessions[0], "2026-06-02", [maria, ben]);
      await cover(martes, bookOne, bookOneSessions[1], "2026-06-09", [maria]);

      const progress = await getGroupBookProgress(TEST_OWNER, martes);

      expect(progress).toMatchObject({
        bookNumber: 1,
        bookTitle: "One By One",
        sessionCount: 6,
        coveredByGroupCount: 2,
        groupComplete: false,
        completeMemberCount: 0,
      });
      expect(progress?.sessions.map((session) => session.coveredByGroup)).toEqual([
        true,
        true,
        false,
        false,
        false,
        false,
      ]);
    });

    it("counts each member's own sessions, never the group's (#2)", async () => {
      for (const [index, sessionId] of bookOneSessions.entries()) {
        await cover(martes, bookOne, sessionId, `2026-06-${String(index + 2).padStart(2, "0")}`, [
          maria,
          ...(index >= 2 ? [nena] : []),
          ...(index < 4 ? [ben] : []),
        ]);
      }

      const progress = await getGroupBookProgress(TEST_OWNER, martes);

      expect(progress).toMatchObject({ groupComplete: true, completeMemberCount: 1 });
      expect(progress?.members).toMatchObject([
        { name: "Ben Cruz", coveredCount: 4, complete: false, behind: true },
        { name: "Maria Santos", coveredCount: 6, complete: true, behind: false },
        { name: "Nena Villamor", coveredCount: 4, complete: false, behind: true },
      ]);
    });

    it("leaves a member who is merely ahead of nothing off the catch-up path", async () => {
      // The group has covered one session and everybody was there: nobody is
      // behind, even though nobody has finished the book either (#5).
      await cover(martes, bookOne, bookOneSessions[0], "2026-06-02", [maria, ben, nena]);

      const progress = await getGroupBookProgress(TEST_OWNER, martes);
      expect(progress?.members.every((member) => !member.behind)).toBe(true);
      expect(progress?.members.every((member) => !member.complete)).toBe(true);
    });

    it("is owner-scoped (#32)", async () => {
      expect(await getGroupBookProgress("someone-else@example.com", martes)).toBeNull();
    });
  });

  describe("leftBehind — the advance checkpoint's list (#18)", () => {
    it("names exactly the members who have not finished, and what they owe", async () => {
      const ben = await createPerson(TEST_OWNER, {
        name: "Ben Cruz",
        homeGroupId: martes,
        joinedOn: "2026-06-01",
      });
      const nena = await createPerson(TEST_OWNER, {
        name: "Nena Villamor",
        homeGroupId: martes,
        joinedOn: "2026-06-20",
      });

      // Sessions 1 and 2 ran before Nena joined; Ben missed 3 and 4.
      await cover(martes, bookOne, bookOneSessions[0], "2026-06-02", [maria, ben]);
      await cover(martes, bookOne, bookOneSessions[1], "2026-06-09", [maria, ben]);
      await cover(martes, bookOne, bookOneSessions[2], "2026-06-30", [maria, nena]);
      await cover(martes, bookOne, bookOneSessions[3], "2026-07-07", [maria, nena]);
      await cover(martes, bookOne, bookOneSessions[4], "2026-07-14", [maria, ben, nena]);
      await cover(martes, bookOne, bookOneSessions[5], "2026-07-21", [maria, ben, nena]);

      const progress = await getGroupBookProgress(TEST_OWNER, martes);
      if (progress === null) throw new Error("the group is on a book");

      expect(leftBehind(progress)).toMatchObject([
        { name: "Ben Cruz", missingSessionNumbers: [3, 4], joinedAtSessionNumber: null },
        // #28 — genuinely behind, and the marker is why the list reads as a
        // plan rather than as a failure.
        { name: "Nena Villamor", missingSessionNumbers: [1, 2], joinedAtSessionNumber: 3 },
      ]);
      // Maria finished the book and is not on it.
      expect(leftBehind(progress).map((member) => member.name)).not.toContain("Maria Santos");
    });

    it("is empty when everybody has finished (#5)", async () => {
      for (const [index, sessionId] of bookOneSessions.entries()) {
        await cover(martes, bookOne, sessionId, `2026-06-${String(index + 2).padStart(2, "0")}`, [
          maria,
        ]);
      }

      const progress = await getGroupBookProgress(TEST_OWNER, martes);
      if (progress === null) throw new Error("the group is on a book");

      expect(leftBehind(progress)).toEqual([]);
    });
  });
});
