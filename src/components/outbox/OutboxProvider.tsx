"use client";

/**
 * Makes the outbox (#72) reachable from any screen and keeps it flushing.
 *
 * Mounted once, inside the shell. It hydrates the pending count from IndexedDB
 * on load, replays anything left from a previous session, and flushes again
 * every time the phone regains a connection — the flush retry path is the
 * normal case, not the edge case (#73), so this fires often and cheaply.
 *
 * The word on every surface is **Upload** (#66/#72). Never "sync".
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

import { browserOutbox } from "@/lib/outbox/browser";
import type { EnqueueInput } from "@/lib/outbox/queue";
import type { OutboxItem } from "@/lib/outbox/store";

/** A stable empty array for the server snapshot — a fresh `[]` each render
 * would make `useSyncExternalStore` loop. */
const NO_ITEMS: OutboxItem[] = [];

type OutboxHandle = {
  /** Pending local writes waiting to leave the phone. Pending-only — a failed
   * write is waiting on `retry`, not on a connection. */
  pending: number;
  /** The un-uploaded items — pending and failed both. A form reads this to
   * learn which offline-created BGroups are still queued; the People and Groups
   * lists read it to draw the pending and failed rows (issue 18). Branch on
   * `item.status`. */
  pendingWrites: OutboxItem[];
  enqueue: (input: EnqueueInput) => Promise<string>;
  flush: () => void;
  /** Reset every failed write to pending and flush — what a "Try again" tap on
   * a failed row calls. */
  retry: () => void;
};

const OutboxContext = createContext<OutboxHandle | null>(null);

export function OutboxProvider({ children }: { children: React.ReactNode }) {
  const outbox = browserOutbox();

  const pending = useSyncExternalStore(
    outbox.subscribe,
    outbox.snapshot,
    () => 0,
  );

  const pendingWrites = useSyncExternalStore(
    outbox.subscribe,
    outbox.itemsSnapshot,
    () => NO_ITEMS,
  );

  const flush = useCallback(() => {
    void outbox.flush();
  }, [outbox]);

  const retry = useCallback(() => {
    void outbox.retry();
  }, [outbox]);

  const enqueue = useCallback(
    (input: EnqueueInput) => outbox.enqueue(input),
    [outbox],
  );

  useEffect(() => {
    void outbox.pending();
    flush();

    const onOnline = () => flush();
    const onVisible = () => {
      if (document.visibilityState === "visible" && navigator.onLine) flush();
    };

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [outbox, flush]);

  const value = useMemo<OutboxHandle>(
    () => ({ pending, pendingWrites, enqueue, flush, retry }),
    [pending, pendingWrites, enqueue, flush, retry],
  );

  return <OutboxContext.Provider value={value}>{children}</OutboxContext.Provider>;
}

export function useOutbox(): OutboxHandle {
  const handle = useContext(OutboxContext);
  if (!handle) {
    throw new Error("useOutbox must be used inside <OutboxProvider>");
  }
  return handle;
}
