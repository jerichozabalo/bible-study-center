import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  TEST_OWNER,
  addPerson,
  bookIdByNumber,
  dbConfigured,
  ensureSchema,
  resetRoster,
} from "../../../tests/fixtures";
import { resetMeetings, sessionIdByNumber } from "../../../tests/meeting-fixtures";
import { query } from "../db";
import { listCompletions, recordSheet } from "../attendance/completions";
import { seedCurriculum } from "../curriculum/seed";
import { createGroup, listGroups } from "../roster/groups";
import { createPerson, getPerson, listGroupMembers } from "../roster/people";
import { createMeeting, listUpcomingMeetings } from "../meetings/meetings";
import { type Transport, createOutbox } from "./queue";
import { memoryStore } from "./store";

/**
 * The outbox replaying against the real modules and the test Postgres branch
 * (PRD "Testing Decisions": no duplicate server rows, leaning on the
 * idempotency the server already has).
 *
 * The transport here is the same shape as the browser one in `transport.ts`,
 * but it calls the module functions directly rather than the "use server"
 * wrappers — the same seam every other database test in this repo uses.
 */
describe.skipIf(!dbConfigured)("outbox replay against Postgres", () => {
  let bookOne: string;
  let sessionThree: string;
  let group: string;
  let ana: string;
  let ben: string;

  /** A transport that can be told to fail its next call once, to stand in for
   * a signal that drops mid-flush. */
  function failableTransport() {
    const failNext = { meeting: false, sheet: false };
    const transport: Transport = {
      meeting: async (ctx) => {
        const id = await createMeeting(TEST_OWNER, {
          groupId: ctx.payload.groupId as string,
          date: ctx.payload.date as string,
          startTime: null,
          durationMinutes: null,
          bookId: ctx.payload.bookId as string | null,
          sessionId: ctx.payload.sessionId as string | null,
          notes: null,
          repeatWeekly: false,
          clientId: ctx.id,
        });
        if (failNext.meeting) {
          failNext.meeting = false;
          throw new Error("fetch failed"); // committed, but the ack was lost
        }
        return { serverId: id };
      },
      sheet: async (ctx) => {
        if (failNext.sheet) {
          failNext.sheet = false;
          throw new Error("fetch failed");
        }
        const meetingId = ctx.payload.meetingRef
          ? ctx.resolve(ctx.payload.meetingRef as string)
          : (ctx.payload.meetingId as string);
        await recordSheet(TEST_OWNER, {
          meetingId,
          marks: ctx.payload.marks as { personId: string; mark: "attended" | "present-only" }[],
          hold: true,
        });
      },
    };
    return { transport, failNext };
  }

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
    ana = await addPerson("Ana", group);
    ben = await addPerson("Ben", group);
  });

  it("replays an offline meeting then its sheet, once each, in dependency order", async () => {
    const { transport } = failableTransport();
    const outbox = createOutbox({ store: memoryStore(), transport, retry: { sleep: async () => {} } });

    const meetingRef = await outbox.enqueue({
      type: "meeting",
      payload: { groupId: group, date: "2026-09-06", bookId: bookOne, sessionId: sessionThree },
    });
    await outbox.enqueue({
      type: "sheet",
      payload: {
        meetingRef,
        marks: [
          { personId: ana, mark: "attended" },
          { personId: ben, mark: "present-only" },
        ],
      },
      deps: [meetingRef],
    });

    const result = await outbox.flush();
    expect(result).toMatchObject({ uploaded: 2, pending: 0, error: null });

    const meetings = await listUpcomingMeetings(TEST_OWNER, { from: "2026-01-01" });
    expect(meetings).toHaveLength(1);
    expect(meetings[0]).toMatchObject({ date: "2026-09-06", status: "held" });

    const marks = await listCompletions(TEST_OWNER, meetings[0].id);
    expect(marks.map((m) => [m.personName, m.mark])).toEqual([
      ["Ana", "attended"],
      ["Ben", "present-only"],
    ]);
  });

  it("does not write a second meeting when the flush is retried after a lost ack (#73)", async () => {
    const { transport, failNext } = failableTransport();
    const outbox = createOutbox({ store: memoryStore(), transport, retry: { attempts: 1, sleep: async () => {} } });

    const meetingRef = await outbox.enqueue({
      type: "meeting",
      payload: { groupId: group, date: "2026-09-13", bookId: bookOne, sessionId: sessionThree },
    });
    await outbox.enqueue({
      type: "sheet",
      payload: { meetingRef, marks: [{ personId: ana, mark: "attended" }] },
      deps: [meetingRef],
    });

    // First flush: the meeting row commits, then the transport throws before
    // the outbox learns its id. Nothing after it uploads.
    failNext.meeting = true;
    const first = await outbox.flush();
    expect(first.uploaded).toBe(0);
    expect(await outbox.pending()).toBe(2);

    // Reconnect: the replay carries the same client id, so the server returns
    // the existing row rather than creating a make-up meeting.
    const second = await outbox.flush();
    expect(second).toMatchObject({ uploaded: 2, pending: 0, error: null });

    const meetings = await listUpcomingMeetings(TEST_OWNER, { from: "2026-01-01" });
    expect(meetings).toHaveLength(1);
    const marks = await listCompletions(TEST_OWNER, meetings[0].id);
    expect(marks).toHaveLength(1);
  });

  it("replays a retried sheet without duplicating completions", async () => {
    const meetingId = await createMeeting(TEST_OWNER, {
      groupId: group,
      date: "2026-09-20",
      startTime: null,
      durationMinutes: null,
      bookId: bookOne,
      sessionId: sessionThree,
      notes: null,
      repeatWeekly: false,
    });

    const { transport, failNext } = failableTransport();
    const outbox = createOutbox({ store: memoryStore(), transport, retry: { attempts: 1, sleep: async () => {} } });

    await outbox.enqueue({
      type: "sheet",
      payload: {
        meetingId,
        marks: [
          { personId: ana, mark: "attended" },
          { personId: ben, mark: "attended" },
        ],
      },
    });

    failNext.sheet = true;
    await outbox.flush();
    await outbox.flush();

    const marks = await listCompletions(TEST_OWNER, meetingId);
    expect(marks).toHaveLength(2);
  });
});

/**
 * Issue 18 — a BGroup and a person created with no signal, replaying against
 * the real modules and the test Postgres branch. The dependency graph is the
 * thing under test: group → person into it → meeting for it → that meeting's
 * sheet, every item replaying only after its parent has a server id, each once,
 * with client-temp ids rewritten to the real ones on the way.
 */
describe.skipIf(!dbConfigured)("outbox replay of offline roster writes (#72 amended)", () => {
  let bookOne: string;
  let sessionThree: string;
  let mara: string;

  /** A transport whose person / group / meeting / sheet calls can each be told
   * to fail once, for a signal that drops mid-flush. It mirrors `transport.ts`
   * but calls the modules directly — the seam every database test here uses. */
  function failableTransport() {
    const failNext = { group: false, person: false, meeting: false, sheet: false };
    const transport: Transport = {
      group: async (ctx) => {
        const id = await createGroup(TEST_OWNER, {
          name: ctx.payload.name as string,
          weekday: ctx.payload.weekday as number,
          startTime: ctx.payload.startTime as string,
          durationMinutes: ctx.payload.durationMinutes as number,
          currentBookId: (ctx.payload.currentBookId as string | null) ?? null,
          clientId: ctx.id,
        });
        if (failNext.group) {
          failNext.group = false;
          throw new Error("fetch failed");
        }
        return { serverId: id };
      },
      person: async (ctx) => {
        const homeGroupId = ctx.payload.homeGroupRef
          ? ctx.resolve(ctx.payload.homeGroupRef as string)
          : ((ctx.payload.homeGroupId as string | null) ?? null);
        const id = await createPerson(TEST_OWNER, {
          name: ctx.payload.name as string,
          // bst-v1.1 issue 1 — the real transport spreads the payload the same
          // way; dropping this field here is what the assertion above catches.
          nickname: (ctx.payload.nickname as string | null) ?? null,
          homeGroupId,
          clientId: ctx.id,
        });
        if (failNext.person) {
          failNext.person = false;
          throw new Error("fetch failed");
        }
        return { serverId: id };
      },
      meeting: async (ctx) => {
        const groupId = ctx.payload.groupRef
          ? ctx.resolve(ctx.payload.groupRef as string)
          : (ctx.payload.groupId as string);
        const id = await createMeeting(TEST_OWNER, {
          groupId,
          date: ctx.payload.date as string,
          startTime: null,
          durationMinutes: null,
          bookId: (ctx.payload.bookId as string | null) ?? null,
          sessionId: (ctx.payload.sessionId as string | null) ?? null,
          notes: null,
          repeatWeekly: false,
          clientId: ctx.id,
        });
        if (failNext.meeting) {
          failNext.meeting = false;
          throw new Error("fetch failed");
        }
        return { serverId: id };
      },
      sheet: async (ctx) => {
        if (failNext.sheet) {
          failNext.sheet = false;
          throw new Error("fetch failed");
        }
        const meetingId = ctx.payload.meetingRef
          ? ctx.resolve(ctx.payload.meetingRef as string)
          : (ctx.payload.meetingId as string);
        await recordSheet(TEST_OWNER, {
          meetingId,
          marks: ctx.payload.marks as { personId: string; mark: "attended" | "present-only" }[],
          hold: true,
        });
      },
    };
    return { transport, failNext };
  }

  beforeAll(async () => {
    await ensureSchema();
    await seedCurriculum();
    bookOne = await bookIdByNumber(1);
    sessionThree = await sessionIdByNumber(bookOne, 3);
  });

  beforeEach(async () => {
    await resetMeetings();
    await resetRoster();
    // A person who already exists on the server — the sheet marks them, so the
    // walk-in path (its own concern, out of scope for #18) is not needed here.
    mara = await addPerson("Mara", null);
  });

  it("replays group → person → meeting → sheet from one flush, in dependency order, once each", async () => {
    const { transport } = failableTransport();
    const outbox = createOutbox({
      store: memoryStore(),
      transport,
      retry: { sleep: async () => {} },
    });

    const groupRef = await outbox.enqueue({
      type: "group",
      payload: {
        name: "BGroup Bukas",
        weekday: 0,
        startTime: "16:00",
        durationMinutes: 90,
        currentBookId: bookOne,
      },
    });
    const personRef = await outbox.enqueue({
      type: "person",
      // bst-v1.1 issue 1 — a nickname saved offline must survive the replay,
      // not just the row the leader saw while queued.
      payload: { name: "Nena Villamor", nickname: "Nena", homeGroupRef: groupRef },
      deps: [groupRef],
    });
    const meetingRef = await outbox.enqueue({
      type: "meeting",
      payload: { groupRef, date: "2026-09-06", bookId: bookOne, sessionId: sessionThree },
      deps: [groupRef],
    });
    await outbox.enqueue({
      type: "sheet",
      payload: { meetingRef, marks: [{ personId: mara, mark: "attended" }] },
      deps: [meetingRef],
    });

    const result = await outbox.flush();
    expect(result).toMatchObject({ uploaded: 4, pending: 0, error: null });

    // The offline group's queue id is the server row's id (the #11 pattern:
    // the outbox item id IS the primary key), and the person and the meeting
    // both resolve their ref to it rather than staying pointed at a temp id.
    const groups = await listGroups(TEST_OWNER);
    expect(groups).toHaveLength(1);
    const serverGroupId = groups[0].id;
    expect(serverGroupId).toBe(groupRef);
    expect((await getPerson(TEST_OWNER, personRef))?.homeGroupId).toBe(serverGroupId);
    // The nickname the leader typed offline came through the replay (#bst-v1.1 #1).
    expect((await getPerson(TEST_OWNER, personRef))?.nickname).toBe("Nena");

    const members = await listGroupMembers(TEST_OWNER, serverGroupId);
    expect(members.map((m) => m.name)).toEqual(["Nena Villamor"]);

    const meetings = await listUpcomingMeetings(TEST_OWNER, { from: "2026-01-01" });
    expect(meetings).toHaveLength(1);
    expect(meetings[0]).toMatchObject({ groupId: serverGroupId, status: "held" });

    const marks = await listCompletions(TEST_OWNER, meetings[0].id);
    expect(marks.map((m) => m.personName)).toEqual(["Mara"]);

    // Nothing replayed twice.
    expect(await outbox.pending()).toBe(0);
  });

  it("resumes after a mid-flush failure with no duplicate rows (#73)", async () => {
    const { transport, failNext } = failableTransport();
    const outbox = createOutbox({
      store: memoryStore(),
      transport,
      retry: { attempts: 1, sleep: async () => {} },
    });

    const groupRef = await outbox.enqueue({
      type: "group",
      payload: {
        name: "BGroup Bukas",
        weekday: 0,
        startTime: "16:00",
        durationMinutes: 90,
        currentBookId: null,
      },
    });
    await outbox.enqueue({
      type: "person",
      payload: { name: "Nena", homeGroupRef: groupRef },
      deps: [groupRef],
    });
    await outbox.enqueue({
      type: "meeting",
      payload: { groupRef, date: "2026-09-13" },
      deps: [groupRef],
    });

    // The person row commits, then the transport throws before the outbox
    // learns its id. The meeting after it does not upload.
    failNext.person = true;
    const first = await outbox.flush();
    expect(first.uploaded).toBe(1); // the group only
    expect(await outbox.pending()).toBe(2);

    const second = await outbox.flush();
    expect(second).toMatchObject({ uploaded: 2, pending: 0, error: null });

    const groupRows = await query<{ n: string }>(
      "SELECT count(*)::text AS n FROM groups WHERE owner_id = $1",
      [TEST_OWNER],
    );
    expect(groupRows[0].n).toBe("1");
    const personRows = await query<{ n: string }>(
      "SELECT count(*)::text AS n FROM people WHERE owner_id = $1 AND name = 'Nena'",
      [TEST_OWNER],
    );
    expect(personRows[0].n).toBe("1");
    const meetings = await listUpcomingMeetings(TEST_OWNER, { from: "2026-01-01" });
    expect(meetings).toHaveLength(1);
  });

  it("a replayed person / group insert is a server-side no-op", async () => {
    const { transport } = failableTransport();
    const outbox = createOutbox({
      store: memoryStore(),
      transport,
      retry: { sleep: async () => {} },
    });

    const groupRef = await outbox.enqueue({
      type: "group",
      payload: {
        name: "BGroup Bukas",
        weekday: 0,
        startTime: "16:00",
        durationMinutes: 90,
        currentBookId: null,
      },
    });
    await outbox.flush();

    const groups = await listGroups(TEST_OWNER);
    const serverGroupId = groups[0].id;

    // Replaying the same queue id is the server returning the existing row.
    const replayed = await createGroup(TEST_OWNER, {
      name: "BGroup Bukas",
      weekday: 0,
      startTime: "16:00",
      durationMinutes: 90,
      currentBookId: null,
      clientId: groupRef,
    });
    expect(replayed).toBe(serverGroupId);
    expect(await listGroups(TEST_OWNER)).toHaveLength(1);

    const personId = await createPerson(TEST_OWNER, { name: "Nena", homeGroupId: null });
    const again = await createPerson(TEST_OWNER, {
      name: "Nena",
      homeGroupId: null,
      clientId: personId,
    });
    expect(again).toBe(personId);
    const person = await getPerson(TEST_OWNER, personId);
    expect(person?.name).toBe("Nena");
  });
});
