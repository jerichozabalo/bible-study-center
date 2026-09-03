/**
 * The attendance outbox (#72) — an append-and-send queue, not a merge engine.
 *
 * The single offline write path in a server-first app (#70): attendance ticks
 * and meeting creation queue on the phone and upload on reconnect. Everything
 * else needs a connection and says so.
 *
 * Four rules, all from #72 and #1:
 *
 *   1. **Single writer, replayed in order.** One phone catching up with itself.
 *      `seq` is the order; a flush walks it and stops at the first item it
 *      cannot send, so nothing after a stuck write jumps the queue.
 *   2. **The server assigns timestamps.** `queuedAt` is a client clock kept for
 *      display only; it never decides anything on the server.
 *   3. **Idempotent replay.** Every item carries a stable `id` that the server
 *      uses as an idempotency key, so a flush that failed halfway and is
 *      retried never writes a row twice.
 *   4. **Dependency graph, not a flat pair.** An item lists the ids of earlier
 *      items it depends on (an offline-created meeting, for its attendance
 *      sheet). At replay the dependency's server id is substituted in. Adding a
 *      write type (issue 18: person, group) is a new transport handler, not a
 *      new code path here.
 *
 * The transport is injected. In the app it calls the server actions in
 * `actions.ts`; in the tests it is a plain fake, which is how the ordering and
 * dependency rules are proven with no network (PRD "faked transport").
 */
import { type RetryOptions, withRetry } from "../retry";
import type { OutboxItem, OutboxStore } from "./store";

export type EnqueueInput = {
  type: string;
  payload: Record<string, unknown>;
  /** Ids of earlier items that must upload first. */
  deps?: string[];
};

export type FlushResult = {
  /** How many items left the phone this flush. */
  uploaded: number;
  /** How many are still queued afterwards. */
  pending: number;
  /** What stopped the flush, if anything. The queue is intact; a later flush
   * resumes from the same point. */
  error: unknown;
};

/** What a transport handler is given for one item. */
export type TransportContext = {
  /** The idempotency key — pass it to the server so a retry is a no-op. */
  id: string;
  payload: Record<string, unknown>;
  /** A dependency's server id, by its queue id. Throws if the dependency has
   * not uploaded — which cannot happen for a well-formed queue, since deps are
   * always enqueued first and the flush is in order. */
  resolve(depId: string): string;
};

export type TransportHandler = (
  ctx: TransportContext,
) => Promise<{ serverId?: string } | void>;

/** One handler per write type. */
export type Transport = Record<string, TransportHandler>;

export type Outbox = {
  enqueue(input: EnqueueInput): Promise<string>;
  flush(): Promise<FlushResult>;
  /** The pending count, read fresh from the store. */
  pending(): Promise<number>;
  /** The last-known pending count, synchronous — for `useSyncExternalStore`. */
  snapshot(): number;
  /**
   * The last-known pending items, synchronous and reference-stable until the
   * queue changes — for `useSyncExternalStore`. A form uses this to learn which
   * offline-created BGroups are still queued, so a person enqueued into one can
   * carry a ref to it (issue 18's dependency graph).
   */
  itemsSnapshot(): OutboxItem[];
  subscribe(listener: () => void): () => void;
};

export class OutboxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutboxError";
  }
}

export function createOutbox(opts: {
  store: OutboxStore;
  transport: Transport;
  retry?: RetryOptions;
  now?: () => number;
  newId?: () => string;
}): Outbox {
  const { store, transport } = opts;
  const now = opts.now ?? (() => Date.now());
  const newId = opts.newId ?? (() => crypto.randomUUID());

  const listeners = new Set<() => void>();
  let count = 0;
  let pendingItems: OutboxItem[] = [];
  let flushing: Promise<FlushResult> | null = null;

  function notify() {
    for (const listener of listeners) listener();
  }

  async function refresh(): Promise<number> {
    const items = await store.all();
    pendingItems = items
      .filter((item) => item.status === "pending")
      .sort((a, b) => a.seq - b.seq);
    count = pendingItems.length;
    notify();
    return count;
  }

  async function enqueue(input: EnqueueInput): Promise<string> {
    const items = await store.all();
    const seq = items.reduce((max, item) => Math.max(max, item.seq), 0) + 1;
    const item: OutboxItem = {
      id: newId(),
      seq,
      type: input.type,
      payload: { ...input.payload },
      deps: [...(input.deps ?? [])],
      status: "pending",
      serverId: null,
      queuedAt: now(),
    };
    await store.put(item);
    await refresh();
    return item.id;
  }

  async function doFlush(): Promise<FlushResult> {
    const items = (await store.all()).sort((a, b) => a.seq - b.seq);

    // Server ids for anything already uploaded — carried across flushes so a
    // dependent that failed last time can still resolve its dependency now.
    const resolved = new Map<string, string>();
    for (const item of items) {
      if (item.status === "done" && item.serverId) resolved.set(item.id, item.serverId);
    }

    let uploaded = 0;
    let error: unknown = null;

    for (const item of items) {
      if (item.status !== "pending") continue;

      const handler = transport[item.type];
      if (!handler) {
        error = new OutboxError(`No transport for queued write "${item.type}".`);
        break;
      }

      try {
        const result = await withRetry(
          () =>
            Promise.resolve(
              handler({
                id: item.id,
                payload: item.payload,
                resolve(depId) {
                  const serverId = resolved.get(depId);
                  if (!serverId) {
                    throw new OutboxError(
                      `Queued write ${item.id} depends on ${depId}, which has not uploaded.`,
                    );
                  }
                  return serverId;
                },
              }),
            ),
          opts.retry,
        );

        item.status = "done";
        item.serverId = result?.serverId ?? null;
        await store.put(item);
        if (item.serverId) resolved.set(item.id, item.serverId);
        uploaded += 1;
      } catch (thrown) {
        // #72: stop at the first item that will not send. The queue is intact
        // and in order; the next flush picks up here.
        error = thrown;
        break;
      }
    }

    await collect(items);
    const pending = await refresh();
    return { uploaded, pending, error };
  }

  /** Drop done items that nothing pending still depends on. */
  async function collect(items: OutboxItem[]): Promise<void> {
    const needed = new Set<string>();
    for (const item of items) {
      if (item.status === "pending") for (const dep of item.deps) needed.add(dep);
    }
    for (const item of items) {
      if (item.status === "done" && !needed.has(item.id)) await store.remove(item.id);
    }
  }

  function flush(): Promise<FlushResult> {
    // One flush at a time: the queue is a single writer (#1), and two
    // concurrent replays would race on the same rows.
    flushing ??= doFlush().finally(() => {
      flushing = null;
    });
    return flushing;
  }

  return {
    enqueue,
    flush,
    pending: refresh,
    snapshot: () => count,
    itemsSnapshot: () => pendingItems,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
