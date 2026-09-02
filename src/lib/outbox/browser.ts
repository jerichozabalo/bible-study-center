"use client";

/**
 * The one outbox instance the app uses (#72). A module-level singleton so the
 * pending count and the in-flight guard are shared by every screen that
 * enqueues or reads it — the attendance sheet, the new-meeting form and the
 * shell's badge are all looking at the same queue.
 */
import { type Outbox, createOutbox } from "./queue";
import { indexedDbStore } from "./store";
import { browserTransport } from "./transport";

let instance: Outbox | null = null;

export function browserOutbox(): Outbox {
  instance ??= createOutbox({
    store: indexedDbStore(),
    transport: browserTransport(),
  });
  return instance;
}
