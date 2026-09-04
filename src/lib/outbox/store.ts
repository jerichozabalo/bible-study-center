/**
 * Where the outbox keeps its queue (#72).
 *
 * The queue has to survive the app being killed — a leader who ticks a sheet in
 * a basement, locks the phone and walks upstairs must still have those ticks an
 * hour later. That means IndexedDB, and it means every read and write is
 * wrapped: a device that refuses storage (private mode, a full disk) should
 * leave the app usable, exactly as the device lock does (`lib/lock/storage`).
 *
 * The core replay logic in `queue.ts` never touches IndexedDB directly — it
 * takes an `OutboxStore`, and the tests hand it `memoryStore()`. That is what
 * the PRD means by "faked transport": the ordering and dependency rules are
 * provable with no browser at all.
 */

/** One queued write. `type` + `deps` are data, so a new write type (issue 18
 * adds person and group, #72 as amended) is a new transport handler and a new
 * `type` string — not a new branch in the replay loop. */
export type OutboxItem = {
  /**
   * Client temp id. Unique, stable for the life of the item, and the
   * idempotency key the server dedupes on — a replayed creation carries the
   * same id, so the second attempt returns the first one's row instead of a
   * duplicate (#73's intent, carried by the id rather than its partial index,
   * which is scoped to generated meetings).
   */
  id: string;
  /** Monotonic insertion order. Replay follows this, always (#72 in order). */
  seq: number;
  /** The write type — keys a transport handler. */
  type: string;
  /** Type-specific data. A field naming another item's id is rewritten to that
   * item's server id at replay time (see `queue.ts`). */
  payload: Record<string, unknown>;
  /** Ids of earlier items that must upload first (#72 — the dependency graph:
   * an offline-created meeting before its attendance sheet). */
  deps: string[];
  /**
   * `pending` — waiting to upload, replayed in `seq` order.
   * `failed` — an upload attempt threw something `retry.ts` will not retry (the
   *   server refused it: a deleted meeting, a name clash). It stays in the
   *   queue, blocks everything behind it, and only a leader-triggered `retry()`
   *   moves it back to `pending`. A plain flush skips it.
   * `done` — uploaded; kept only until nothing pending still names it as a dep.
   */
  status: "pending" | "failed" | "done";
  /** Why the last attempt failed — the message a failed row shows the leader.
   * Set only while `status` is `"failed"`; cleared when it returns to
   * `"pending"`. */
  error?: string;
  /** The server id once uploaded. Kept until no pending item still needs it,
   * then garbage-collected. */
  serverId: string | null;
  /** Client clock, for display only. The server assigns the real timestamp
   * (#72) — this never crosses the wire as anything authoritative. */
  queuedAt: number;
};

export type OutboxStore = {
  all(): Promise<OutboxItem[]>;
  put(item: OutboxItem): Promise<void>;
  remove(id: string): Promise<void>;
};

/** The fake the tests use, and the fallback when IndexedDB is unavailable. */
export function memoryStore(seed: OutboxItem[] = []): OutboxStore {
  const items = new Map<string, OutboxItem>(seed.map((item) => [item.id, clone(item)]));
  return {
    async all() {
      return [...items.values()].map(clone);
    },
    async put(item) {
      items.set(item.id, clone(item));
    },
    async remove(id) {
      items.delete(id);
    },
  };
}

const DB_NAME = "bst-outbox";
const DB_VERSION = 1;
const STORE = "items";

/**
 * The real store: one IndexedDB object store keyed by `id`.
 *
 * Every method resolves rather than rejects on a storage failure — `all()`
 * returns what it can (an empty list at worst), and a failed `put` means the
 * write did not queue, which the caller surfaces the same way it would surface
 * being offline. A thrown error here would take down whatever screen enqueued.
 */
export function indexedDbStore(): OutboxStore {
  function open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await open();
    try {
      return await new Promise<T>((resolve, reject) => {
        const request = run(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  }

  return {
    async all() {
      try {
        const rows = (await tx<OutboxItem[]>("readonly", (store) => store.getAll())) ?? [];
        return rows;
      } catch {
        return [];
      }
    },
    async put(item) {
      try {
        await tx("readwrite", (store) => store.put(item));
      } catch {
        // The write did not queue. The caller treats this like any other
        // failure to save — nothing useful can be said to the leader here.
      }
    },
    async remove(id) {
      try {
        await tx("readwrite", (store) => store.delete(id));
      } catch {
        // A stale done-item left behind is harmless: the next flush re-checks
        // and re-collects it.
      }
    },
  };
}

function clone(item: OutboxItem): OutboxItem {
  return {
    ...item,
    payload: { ...item.payload },
    deps: [...item.deps],
  };
}
