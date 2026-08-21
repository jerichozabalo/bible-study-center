import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  TEST_OWNER,
  addPerson,
  bookIdByNumber,
  dbConfigured,
  ensureSchema,
  resetRoster,
} from "../../../tests/fixtures";
import { addHeldMeeting, resetMeetings, sessionIdByNumber } from "../../../tests/meeting-fixtures";
import { seedCurriculum } from "../curriculum/seed";
import { archiveGroup, createGroup } from "../roster/groups";
import { createMeeting } from "./meetings";
import { getMeetingPrefill, listPickerGroups, nextSession } from "./prefill";

describe("nextSession", () => {
  const sessions = [
    { id: "a", number: 1, title: "One Truth" },
    { id: "b", number: 2, title: "One Way" },
    { id: "c", number: 3, title: "One Proof" },
  ];

  it("starts at the first session when nothing has been covered", () => {
    expect(nextSession(sessions, null)).toMatchObject({ number: 1 });
  });

  it("takes the one after what was last covered", () => {
    expect(nextSession(sessions, 2)).toMatchObject({ number: 3 });
  });

  it("has nothing to offer once the book is finished (#4 asks what is next)", () => {
    expect(nextSession(sessions, 3)).toBeNull();
  });

  it("has nothing to offer for a book with no sessions", () => {
    expect(nextSession([], null)).toBeNull();
  });
});

describe.skipIf(!dbConfigured)("getMeetingPrefill", () => {
  let bookOne: string;
  let bookTwo: string;
  let group: string;

  beforeAll(async () => {
    await ensureSchema();
    await seedCurriculum();
    bookOne = await bookIdByNumber(1);
    bookTwo = await bookIdByNumber(2);
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

  it("prefills the group's current book and its first session before anything is held (#53)", async () => {
    const prefill = await getMeetingPrefill(TEST_OWNER, group);

    expect(prefill).toMatchObject({
      bookId: bookOne,
      bookNumber: 1,
      bookTitle: "One By One",
      sessionNumber: 1,
      startTime: "16:00:00",
      durationMinutes: 90,
    });
    expect(prefill?.sessions).toHaveLength(6);
  });

  it("prefills the session after the group's last HELD meeting (#53)", async () => {
    await addHeldMeeting(TEST_OWNER, group, "2026-08-09", {
      bookId: bookOne,
      sessionId: await sessionIdByNumber(bookOne, 2),
    });

    expect(await getMeetingPrefill(TEST_OWNER, group)).toMatchObject({
      sessionNumber: 3,
      sessionId: await sessionIdByNumber(bookOne, 3),
    });
  });

  it("ignores a proposed meeting — only HELD moves the agenda on (#47/#53)", async () => {
    await addHeldMeeting(TEST_OWNER, group, "2026-08-09", {
      bookId: bookOne,
      sessionId: await sessionIdByNumber(bookOne, 2),
    });
    // The night after it, scheduled but not yet held.
    await createProposed(group, "2026-08-16", await sessionIdByNumber(bookOne, 3));

    expect(await getMeetingPrefill(TEST_OWNER, group)).toMatchObject({ sessionNumber: 3 });
  });

  it("does not let a no-session fellowship night advance the agenda (#26)", async () => {
    await addHeldMeeting(TEST_OWNER, group, "2026-08-09", {
      bookId: bookOne,
      sessionId: await sessionIdByNumber(bookOne, 2),
    });
    await addHeldMeeting(TEST_OWNER, group, "2026-08-16");

    expect(await getMeetingPrefill(TEST_OWNER, group)).toMatchObject({ sessionNumber: 3 });
  });

  it("ignores held meetings on a book the group has moved off (#17)", async () => {
    await addHeldMeeting(TEST_OWNER, group, "2026-08-09", {
      bookId: bookTwo,
      sessionId: await sessionIdByNumber(bookTwo, 4),
    });

    expect(await getMeetingPrefill(TEST_OWNER, group)).toMatchObject({ sessionNumber: 1 });
  });

  it("offers no session once every session of the book is held", async () => {
    await addHeldMeeting(TEST_OWNER, group, "2026-08-09", {
      bookId: bookOne,
      sessionId: await sessionIdByNumber(bookOne, 6),
    });

    expect(await getMeetingPrefill(TEST_OWNER, group)).toMatchObject({
      bookId: bookOne,
      sessionId: null,
      sessionNumber: null,
    });
  });

  it("prefills nothing for a group with no book chosen yet", async () => {
    const bookless = await createGroup(TEST_OWNER, {
      name: "Workplace BGroup",
      weekday: 4,
      startTime: "12:00",
      durationMinutes: 60,
      currentBookId: null,
    });

    expect(await getMeetingPrefill(TEST_OWNER, bookless)).toMatchObject({
      bookId: null,
      sessionId: null,
      sessions: [],
    });
  });

  it("has nothing for an archived group or someone else's (#60/#32)", async () => {
    expect(await getMeetingPrefill("someone.else@example.com", group)).toBeNull();

    await archiveGroup(TEST_OWNER, group);
    expect(await getMeetingPrefill(TEST_OWNER, group)).toBeNull();
  });

  async function createProposed(groupId: string, date: string, sessionId: string) {
    return createMeeting(TEST_OWNER, {
      groupId,
      date,
      startTime: null,
      durationMinutes: null,
      bookId: bookOne,
      sessionId,
      notes: null,
      repeatWeekly: false,
    });
  }
});

describe.skipIf(!dbConfigured)("listPickerGroups", () => {
  let bookOne: string;

  beforeAll(async () => {
    await ensureSchema();
    await seedCurriculum();
    bookOne = await bookIdByNumber(1);
  });

  beforeEach(async () => {
    await resetMeetings();
    await resetRoster();
  });

  async function group(name: string, weekday: number) {
    return createGroup(TEST_OWNER, {
      name,
      weekday,
      startTime: "19:00",
      durationMinutes: 90,
      currentBookId: bookOne,
    });
  }

  it("orders by the last HELD meeting, most recent first, never-met last (#63)", async () => {
    const tuesday = await group("Tuesday BGroup", 2);
    const sunday = await group("Sunday Youth", 0);
    const workplace = await group("Workplace BGroup", 4);

    await addHeldMeeting(TEST_OWNER, tuesday, "2026-08-12");
    await addHeldMeeting(TEST_OWNER, sunday, "2026-08-17");
    // `workplace` has never met, and a proposed night does not count as met.

    expect((await listPickerGroups(TEST_OWNER)).map((row) => row.id)).toEqual([
      sunday,
      tuesday,
      workplace,
    ]);
  });

  it("keeps archived groups out of the picker (#60)", async () => {
    const live = await group("Tuesday BGroup", 2);
    const gone = await group("Couples BGroup", 5);
    await archiveGroup(TEST_OWNER, gone);

    expect((await listPickerGroups(TEST_OWNER)).map((row) => row.id)).toEqual([live]);
  });

  it("carries what the card prints, and the prefilled agenda behind it (#53/#63)", async () => {
    const tuesday = await group("Tuesday BGroup", 2);
    await addPerson("Maria Santos", tuesday);
    await addPerson("Ben Cruz", tuesday);
    await addHeldMeeting(TEST_OWNER, tuesday, "2026-08-12", {
      bookId: bookOne,
      sessionId: await sessionIdByNumber(bookOne, 2),
    });

    const [card] = await listPickerGroups(TEST_OWNER);

    expect(card).toMatchObject({
      name: "Tuesday BGroup",
      memberCount: 2,
      currentBookNumber: 1,
      lastHeldDate: "2026-08-12",
    });
    expect(card.prefill).toMatchObject({ bookId: bookOne, sessionNumber: 3 });
    expect(card.prefill.sessions).toHaveLength(6);
  });

  it("shows nobody else's groups (#32)", async () => {
    await group("Tuesday BGroup", 2);

    expect(await listPickerGroups("someone.else@example.com")).toEqual([]);
  });
});
