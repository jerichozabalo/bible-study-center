import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  TEST_OWNER,
  addPerson,
  bookIdByNumber,
  dbConfigured,
  ensureSchema,
  resetRoster,
} from "../../../tests/fixtures";
import {
  addCancelledMeeting,
  resetMeetings,
  sessionIdByNumber,
} from "../../../tests/meeting-fixtures";
import { resetCustomBooks } from "../../../tests/curriculum-fixtures";
import { createBook, updateBook } from "../curriculum/custom";
import { getBook } from "../curriculum/books";
import { seedCurriculum } from "../curriculum/seed";
import { createMeeting, getMeeting } from "../meetings/meetings";
import { createGroup } from "../roster/groups";
import { getPerson, updatePerson } from "../roster/people";
import {
  AttendanceValidationError,
  addWalkIn,
  listCompletionCorrections,
  listCompletions,
  listCoveredSessions,
  recordSheet,
} from "./completions";

/**
 * The tick model at the module boundary the attendance sheet posts to (#25/#65).
 */
describe.skipIf(!dbConfigured)("attendance completions", () => {
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
    // Meetings first: completions cascade from them, and the groups the roster
    // reset deletes are what the meetings point at.
    await resetMeetings();
    await resetRoster();
    await resetCustomBooks();

    group = await createGroup(TEST_OWNER, {
      name: "BGroup Martes",
      weekday: 2,
      startTime: "19:00",
      durationMinutes: 90,
      currentBookId: bookOne,
    });
    maria = await addPerson("Maria Santos", group);
    ben = await addPerson("Ben Cruz", group);
    meeting = await createMeeting(TEST_OWNER, lesson());
  });

  it("records one tick as attended plus the meeting's session, stamped to the leader (#25/#32/#65)", async () => {
    await recordSheet(TEST_OWNER, {
      meetingId: meeting,
      marks: [{ personId: maria, mark: "attended" }],
      hold: false,
    });

    expect(await listCompletions(TEST_OWNER, meeting)).toMatchObject([
      { personId: maria, meetingId: meeting, sessionId: sessionFour, mark: "attended" },
    ]);
    expect(await listCompletions("someone.else@example.com", meeting)).toEqual([]);
  });

  it("keeps exactly one row per person and meeting (#65)", async () => {
    await recordSheet(TEST_OWNER, {
      meetingId: meeting,
      marks: [{ personId: maria, mark: "attended" }],
      hold: false,
    });
    await recordSheet(TEST_OWNER, {
      meetingId: meeting,
      marks: [{ personId: maria, mark: "present-only" }],
      hold: false,
    });

    expect(await listCompletions(TEST_OWNER, meeting)).toMatchObject([
      { personId: maria, mark: "present-only", sessionId: null },
    ]);
  });

  it("records presence without completion for present only (#25)", async () => {
    await recordSheet(TEST_OWNER, {
      meetingId: meeting,
      marks: [
        { personId: maria, mark: "attended" },
        { personId: ben, mark: "present-only" },
      ],
      hold: true,
    });

    expect(await listCoveredSessions(TEST_OWNER, maria)).toMatchObject([
      { sessionId: sessionFour, sessionNumber: 4, bookNumber: 1 },
    ]);
    // Ben was in the room and is on the record as such — he simply covered
    // nothing, so nothing is credited to him.
    expect(await listCoveredSessions(TEST_OWNER, ben)).toEqual([]);
    expect(await listCompletions(TEST_OWNER, meeting)).toMatchObject([
      { personId: ben, mark: "present-only", sessionId: null },
      { personId: maria, mark: "attended", sessionId: sessionFour },
    ]);
  });

  it("writes a NULL-session row for every tick at a no-session meeting (#26/#65)", async () => {
    const fellowship = await createMeeting(TEST_OWNER, lesson({ bookId: null, sessionId: null }));

    await recordSheet(TEST_OWNER, {
      meetingId: fellowship,
      marks: [
        { personId: maria, mark: "attended" },
        { personId: ben, mark: "attended" },
      ],
      hold: true,
    });

    expect(await listCompletions(TEST_OWNER, fellowship)).toMatchObject([
      { personId: ben, mark: "attended", sessionId: null },
      { personId: maria, mark: "attended", sessionId: null },
    ]);
    // The whole point of #65's nullable session: contact is recorded, nothing
    // is credited toward any book.
    expect(await listCoveredSessions(TEST_OWNER, maria)).toEqual([]);
  });

  it("leaves a retired session out of what a person has covered (#24)", async () => {
    const own = await createBook(TEST_OWNER, {
      title: "Panimula",
      sessions: [{ id: null, title: "Sino si Hesus" }, { id: null, title: "Ang Simbahan" }],
    });
    const sessions = (await getBook(own))!.sessions;
    const night = await createMeeting(
      TEST_OWNER,
      lesson({ bookId: own, sessionId: sessions[1].id }),
    );
    await recordSheet(TEST_OWNER, {
      meetingId: night,
      marks: [{ personId: maria, mark: "attended" }],
      hold: true,
    });

    await updateBook(TEST_OWNER, own, {
      title: "Panimula",
      sessions: [{ id: sessions[0].id, title: "Sino si Hesus" }],
    });

    // The completion still resolves — the row is not deleted (migration 005) —
    // but a session that is no longer part of the book credits nothing.
    expect(await listCoveredSessions(TEST_OWNER, maria)).toEqual([]);
    expect(await listCompletions(TEST_OWNER, night)).toHaveLength(1);
  });

  it("is what marks the meeting held, and only when it is confirmed (#47)", async () => {
    await recordSheet(TEST_OWNER, {
      meetingId: meeting,
      marks: [{ personId: maria, mark: "attended" }],
      hold: false,
    });
    expect((await getMeeting(TEST_OWNER, meeting))?.status).toBe("proposed");

    await recordSheet(TEST_OWNER, {
      meetingId: meeting,
      marks: [{ personId: maria, mark: "attended" }],
      hold: true,
    });
    expect((await getMeeting(TEST_OWNER, meeting))?.status).toBe("held");
  });

  it("refuses a cancelled meeting", async () => {
    const cancelled = await addCancelledMeeting(TEST_OWNER, group, "2026-08-18");

    await expect(
      recordSheet(TEST_OWNER, {
        meetingId: cancelled,
        marks: [{ personId: maria, mark: "attended" }],
        hold: true,
      }),
    ).rejects.toBeInstanceOf(AttendanceValidationError);
  });

  it("refuses a meeting or a person that is not the leader's (#32)", async () => {
    await expect(
      recordSheet("someone.else@example.com", {
        meetingId: meeting,
        marks: [{ personId: maria, mark: "attended" }],
        hold: true,
      }),
    ).rejects.toBeInstanceOf(AttendanceValidationError);

    await expect(
      recordSheet(TEST_OWNER, {
        meetingId: meeting,
        marks: [{ personId: "not-a-person", mark: "attended" }],
        hold: false,
      }),
    ).rejects.toBeInstanceOf(AttendanceValidationError);
  });

  it("saves a walk-in on a name alone, in the meeting's BGroup, flagged incomplete (#25/#67)", async () => {
    const nico = await addWalkIn(TEST_OWNER, meeting, "  Nico  ");

    expect(await getPerson(TEST_OWNER, nico)).toMatchObject({
      name: "Nico",
      homeGroupId: group,
      phone: null,
      email: null,
      contactIncomplete: true,
    });
    // They are in the room — that is why they were added from the sheet.
    expect(await listCompletions(TEST_OWNER, meeting)).toMatchObject([
      { personId: nico, mark: "attended", sessionId: sessionFour },
    ]);
  });

  it("refuses a walk-in with no name at all (#67)", async () => {
    await expect(addWalkIn(TEST_OWNER, meeting, "   ")).rejects.toThrow();
  });

  it("tombstones a correction to a sheet that was already held (#24)", async () => {
    await recordSheet(TEST_OWNER, {
      meetingId: meeting,
      marks: [{ personId: maria, mark: "attended" }],
      hold: true,
    });

    await recordSheet(TEST_OWNER, {
      meetingId: meeting,
      marks: [{ personId: maria, mark: "present-only" }],
      hold: true,
    });

    const corrections = await listCompletionCorrections(TEST_OWNER, meeting);
    expect(corrections).toHaveLength(1);
    expect(corrections[0]).toMatchObject({ personId: maria, reason: "edit" });
    expect(corrections[0].previous).toMatchObject({ mark: "attended", session_id: sessionFour });
    expect(await listCompletions(TEST_OWNER, meeting)).toMatchObject([
      { personId: maria, mark: "present-only" },
    ]);
  });

  it("keeps the record of a tick that was taken back (#24)", async () => {
    await recordSheet(TEST_OWNER, {
      meetingId: meeting,
      marks: [{ personId: maria, mark: "attended" }],
      hold: true,
    });

    await recordSheet(TEST_OWNER, {
      meetingId: meeting,
      marks: [{ personId: maria, mark: null }],
      hold: true,
    });

    expect(await listCompletions(TEST_OWNER, meeting)).toEqual([]);
    expect(await listCompletionCorrections(TEST_OWNER, meeting)).toMatchObject([
      { personId: maria, reason: "cleared", previous: { mark: "attended" } },
    ]);
  });

  it("records no correction when a sheet is saved unchanged", async () => {
    const marks = [
      { personId: maria, mark: "attended" as const },
      { personId: ben, mark: null },
    ];

    await recordSheet(TEST_OWNER, { meetingId: meeting, marks, hold: true });
    await recordSheet(TEST_OWNER, { meetingId: meeting, marks, hold: true });

    expect(await listCompletionCorrections(TEST_OWNER, meeting)).toEqual([]);
  });

  /**
   * #27, and the fixture issue 3 promised and could not build: there was no
   * completions table then, so the guarantee was asserted about the mechanism
   * rather than about the rows. This is the rows.
   */
  it("leaves a transferred person's completions exactly as they were (#27)", async () => {
    const fellowship = await createMeeting(TEST_OWNER, lesson({ bookId: null, sessionId: null }));
    await recordSheet(TEST_OWNER, {
      meetingId: meeting,
      marks: [{ personId: maria, mark: "attended" }],
      hold: true,
    });
    await recordSheet(TEST_OWNER, {
      meetingId: fellowship,
      marks: [{ personId: maria, mark: "present-only" }],
      hold: true,
    });
    const before = await listCoveredSessions(TEST_OWNER, maria);
    const rows = [
      ...(await listCompletions(TEST_OWNER, meeting)),
      ...(await listCompletions(TEST_OWNER, fellowship)),
    ];

    const sunday = await createGroup(TEST_OWNER, {
      name: "BGroup Linggo",
      weekday: 0,
      startTime: "16:00",
      durationMinutes: 90,
      currentBookId: bookOne,
    });
    await updatePerson(TEST_OWNER, maria, { name: "Maria Santos", homeGroupId: sunday });

    expect((await getPerson(TEST_OWNER, maria))?.homeGroupId).toBe(sunday);
    // Same rows, same sessions, same meetings — a move changes where someone
    // belongs, never what they have covered.
    expect([
      ...(await listCompletions(TEST_OWNER, meeting)),
      ...(await listCompletions(TEST_OWNER, fellowship)),
    ]).toEqual(rows);
    expect(await listCoveredSessions(TEST_OWNER, maria)).toEqual(before);
  });

  function lesson(overrides: Partial<Parameters<typeof createMeeting>[1]> = {}) {
    return {
      groupId: group,
      date: "2026-08-25",
      startTime: null,
      durationMinutes: null,
      bookId: bookOne,
      sessionId: sessionFour,
      notes: null,
      repeatWeekly: false,
      ...overrides,
    };
  }
});
