import { describe, expect, it, vi } from "vitest";

import { type Transport, createOutbox } from "./queue";
import { type OutboxItem, memoryStore } from "./store";

/**
 * The outbox's replay rules (#72), proven with a faked transport and an
 * in-memory store — no IndexedDB, no network (PRD "Testing Decisions").
 */

/** A transport that records what it was asked to send, in the order it was asked. */
function recordingTransport(overrides: Partial<Transport> = {}): {
  transport: Transport;
  sent: Array<{ type: string; id: string; payload: Record<string, unknown> }>;
} {
  const sent: Array<{ type: string; id: string; payload: Record<string, unknown> }> = [];
  const transport: Transport = {
    meeting: async (ctx) => {
      sent.push({ type: "meeting", id: ctx.id, payload: { ...ctx.payload } });
      return { serverId: `srv-${ctx.id}` };
    },
    sheet: async (ctx) => {
      const meetingId = ctx.payload.meetingRef
        ? ctx.resolve(ctx.payload.meetingRef as string)
        : ctx.payload.meetingId;
      sent.push({ type: "sheet", id: ctx.id, payload: { ...ctx.payload, meetingId } });
    },
    ...overrides,
  };
  return { transport, sent };
}

const noSleep = { sleep: async () => {} };

describe("createOutbox", () => {
  it("counts pending writes and clears the count as they upload", async () => {
    const store = memoryStore();
    const { transport } = recordingTransport();
    const outbox = createOutbox({ store, transport, retry: noSleep });

    await outbox.enqueue({ type: "sheet", payload: { meetingId: "m1", marks: [] } });
    await outbox.enqueue({ type: "sheet", payload: { meetingId: "m2", marks: [] } });
    expect(await outbox.pending()).toBe(2);
    expect(outbox.snapshot()).toBe(2);

    const result = await outbox.flush();
    expect(result).toMatchObject({ uploaded: 2, pending: 0, error: null });
    expect(await outbox.pending()).toBe(0);
  });

  it("replays writes in the order they were enqueued", async () => {
    const store = memoryStore();
    const { transport, sent } = recordingTransport();
    const outbox = createOutbox({ store, transport, retry: noSleep });

    await outbox.enqueue({ type: "sheet", payload: { meetingId: "a" } });
    await outbox.enqueue({ type: "sheet", payload: { meetingId: "b" } });
    await outbox.enqueue({ type: "sheet", payload: { meetingId: "c" } });

    await outbox.flush();

    expect(sent.map((s) => s.payload.meetingId)).toEqual(["a", "b", "c"]);
  });

  it("uploads an offline-created meeting before its attendance sheet, substituting the server id", async () => {
    const store = memoryStore();
    const { transport, sent } = recordingTransport();
    const outbox = createOutbox({ store, transport, retry: noSleep });

    const meetingId = await outbox.enqueue({
      type: "meeting",
      payload: { groupId: "g1", date: "2026-09-02" },
    });
    await outbox.enqueue({
      type: "sheet",
      payload: { meetingRef: meetingId, marks: [{ personId: "p1", mark: "attended" }] },
      deps: [meetingId],
    });

    await outbox.flush();

    expect(sent.map((s) => s.type)).toEqual(["meeting", "sheet"]);
    expect(sent[1].payload.meetingId).toBe(`srv-${meetingId}`);
    expect(await outbox.pending()).toBe(0);
  });

  it("stops at the first write it cannot send and leaves the rest queued, in order", async () => {
    const store = memoryStore();
    const { sent } = recordingTransport();
    let failSheet = true;
    const transport: Transport = {
      meeting: async (ctx) => {
        sent.push({ type: "meeting", id: ctx.id, payload: {} });
        return { serverId: `srv-${ctx.id}` };
      },
      sheet: async (ctx) => {
        if (failSheet) throw new Error("boom");
        sent.push({ type: "sheet", id: ctx.id, payload: { ...ctx.payload } });
      },
    };
    const outbox = createOutbox({ store, transport, retry: { ...noSleep, attempts: 1 } });

    const m = await outbox.enqueue({ type: "meeting", payload: {} });
    await outbox.enqueue({ type: "sheet", payload: { meetingRef: m, n: 1 }, deps: [m] });
    await outbox.enqueue({ type: "sheet", payload: { meetingRef: m, n: 2 }, deps: [m] });

    const first = await outbox.flush();
    expect(first.uploaded).toBe(1); // the meeting only
    expect(first.error).toBeInstanceOf(Error);
    expect(await outbox.pending()).toBe(2); // both sheets still waiting

    // The failure clears; the retry resumes from the stuck sheet, in order,
    // and does not re-send the meeting.
    failSheet = false;
    const second = await outbox.flush();
    expect(second).toMatchObject({ uploaded: 2, pending: 0, error: null });
    expect(sent.filter((s) => s.type === "meeting")).toHaveLength(1);
    expect(sent.filter((s) => s.type === "sheet").map((s) => s.payload.n)).toEqual([1, 2]);
  });

  it("does not re-send a write that already uploaded when a later one fails", async () => {
    const store = memoryStore();
    const calls: string[] = [];
    let failSecond = true;
    const transport: Transport = {
      sheet: async (ctx) => {
        calls.push(ctx.payload.tag as string);
        if (ctx.payload.tag === "second" && failSecond) throw new Error("lost signal");
      },
    };
    const outbox = createOutbox({ store, transport, retry: { ...noSleep, attempts: 1 } });

    await outbox.enqueue({ type: "sheet", payload: { tag: "first" } });
    await outbox.enqueue({ type: "sheet", payload: { tag: "second" } });

    await outbox.flush();
    failSecond = false;
    await outbox.flush();

    expect(calls).toEqual(["first", "second", "second"]);
  });

  it("keeps the pending count across a simulated restart", async () => {
    const store = memoryStore();
    const { transport } = recordingTransport();

    const before = createOutbox({ store, transport, retry: noSleep });
    await before.enqueue({ type: "sheet", payload: { meetingId: "m1" } });
    await before.enqueue({ type: "sheet", payload: { meetingId: "m2" } });

    // The app is killed and reopened: a fresh outbox over the same storage.
    const after = createOutbox({ store, transport, retry: noSleep });
    expect(after.snapshot()).toBe(0); // nothing read yet
    expect(await after.pending()).toBe(2);
    expect(after.snapshot()).toBe(2);

    await after.flush();
    const restarted = createOutbox({ store, transport, retry: noSleep });
    expect(await restarted.pending()).toBe(0);
  });

  it("retries a transient failure within a single flush", async () => {
    const store = memoryStore();
    const attempt = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(undefined);
    const transport: Transport = { sheet: () => attempt() };
    const outbox = createOutbox({ store, transport, retry: noSleep });

    await outbox.enqueue({ type: "sheet", payload: {} });
    const result = await outbox.flush();

    expect(attempt).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ uploaded: 1, pending: 0, error: null });
  });

  it("notifies subscribers when the count changes", async () => {
    const store = memoryStore();
    const { transport } = recordingTransport();
    const outbox = createOutbox({ store, transport, retry: noSleep });
    const listener = vi.fn();
    outbox.subscribe(listener);

    await outbox.enqueue({ type: "sheet", payload: {} });
    expect(listener).toHaveBeenCalled();
  });

  it("survives a corrupt queue entry from an older build without blocking the rest", async () => {
    // A `type` no handler knows: the flush stops rather than dropping it, and
    // says why — but the count still reflects reality.
    const rogue: OutboxItem = {
      id: "rogue",
      seq: 1,
      type: "telegram",
      payload: {},
      deps: [],
      status: "pending",
      serverId: null,
      queuedAt: 0,
    };
    const store = memoryStore([rogue]);
    const { transport } = recordingTransport();
    const outbox = createOutbox({ store, transport, retry: noSleep });

    const result = await outbox.flush();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.uploaded).toBe(0);
    expect(await outbox.pending()).toBe(1);
  });
});
