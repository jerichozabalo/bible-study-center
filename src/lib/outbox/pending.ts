/**
 * The queue's write types and the pure views the UI takes of a still-queued
 * item — kept clear of `transport.ts` because that file reaches the server
 * actions (`"use server"` → `server-only`), and a form, a list and a plain
 * vitest node test all need these without dragging that in.
 *
 * The ref pattern (#72's dependency graph): a payload field that names an
 * earlier, still-queued item carries `<thing>Ref` and is resolved to that
 * item's server id at replay time; the plain `<thing>Id` field is a real server
 * id. Exactly one of each pair is set. `meetingRef` (sheet), `groupRef`
 * (meeting) and `homeGroupRef` (person) all work the same way.
 */
import type { Mark } from "../attendance/completions";
import type { OutboxItem } from "./store";

export const MEETING_WRITE = "meeting";
export const SHEET_WRITE = "sheet";
export const GROUP_WRITE = "group";
export const PERSON_WRITE = "person";

/** What the new-meeting form enqueues. `groupRef` names an offline-created
 * BGroup still in the queue; `groupId` is a real server id. Exactly one is
 * set. */
export type MeetingPayload = {
  groupId?: string;
  groupRef?: string;
  date: string;
  startTime: string | null;
  durationMinutes: number | null;
  bookId: string | null;
  sessionId: string | null;
  notes: string | null;
  repeatWeekly: boolean;
};

/** What the attendance sheet enqueues. `meetingRef` names an offline-created
 * meeting still in the queue; `meetingId` is a real server id. Exactly one is
 * set. */
export type SheetPayload = {
  meetingId?: string;
  meetingRef?: string;
  marks: { personId: string; mark: Mark | null }[];
};

/** What the new-BGroup form enqueues — the create form's fields, no more. */
export type GroupPayload = {
  name: string;
  weekday: number;
  startTime: string;
  durationMinutes: number;
  /** Books are never created offline, so this is always a real server id. */
  currentBookId: string | null;
};

/** What the add-a-person form enqueues. `homeGroupRef` names an offline-created
 * BGroup still in the queue; `homeGroupId` is a real server id. At most one is
 * set — a name-only walk-in (#9/#67) sets neither. */
export type PersonPayload = {
  name: string;
  phone: string | null;
  email: string | null;
  homeGroupId?: string | null;
  homeGroupRef?: string;
  joinedOn: string | null;
  birthday: string | null;
  address: string | null;
  civilStatus: string | null;
  spiritualStatus: string | null;
  baptized: boolean;
  baptizedOn: string | null;
  invitedBy: string | null;
  notes: string | null;
};

/** A still-queued offline BGroup, as a form's home-group picker needs it: the
 * queue id to enqueue a ref against, and the name the leader typed. */
export type PendingGroup = { queueId: string; name: string };

/** The offline-created BGroups still waiting to upload — for a create form that
 * has to offer them as home-group options and enqueue a `homeGroupRef` +
 * `deps` against the one that is picked. Failed rows are included: a retry
 * still gives them a server id, so a person can be enqueued against one. */
export function pendingGroups(items: OutboxItem[]): PendingGroup[] {
  return items
    .filter((item) => item.type === GROUP_WRITE)
    .map((item) => ({
      queueId: item.id,
      name: String((item.payload as unknown as GroupPayload).name ?? ""),
    }));
}

/** A queued-write server action's result: the created row's id under a
 * type-specific key, or the server's refusal handed back as data. */
export type UploadResult<K extends string> = { [P in K]: string } | { error: string };

/**
 * Turn that result into the id the transport hands back to the queue, or throw
 * the server's sentence as a plain `Error`.
 *
 * The action returns the refusal instead of throwing it because Next redacts a
 * raw server-action throw in a production build to "Minified React error #…" —
 * useless on a failed row. Rethrown here it is a normal, non-transient error,
 * so the queue marks the item `failed` with a message a leader can read and
 * act on ("That BGroup is archived — pick one that is running").
 */
export function unwrapUpload<K extends string>(result: UploadResult<K>, key: K): string {
  if ("error" in result) throw new Error(result.error);
  return result[key];
}

/** One offline-created person or BGroup, as the People / Groups list draws it:
 * a row that is not on the server yet, either waiting for signal or stuck on a
 * refusal the leader can retry (issue 18). */
export type PendingRosterRow = {
  queueId: string;
  name: string;
  status: "pending" | "failed";
  /** The server's reason, on a failed row — shown so "Try again" is an informed
   * choice, not a shot in the dark. */
  error: string | null;
};

/** The offline-created rows of one kind (`PERSON_WRITE` or `GROUP_WRITE`) still
 * in the queue, newest first — the order they would sit above a server-rendered
 * list. A name-only walk-in (#9/#67) with nothing typed shows as "Unnamed" so
 * the row is never blank. */
export function pendingRosterRows(
  items: OutboxItem[],
  type: typeof PERSON_WRITE | typeof GROUP_WRITE,
): PendingRosterRow[] {
  return items
    .filter((item) => item.type === type && item.status !== "done")
    .sort((a, b) => b.seq - a.seq)
    .map((item) => ({
      queueId: item.id,
      name: String((item.payload as { name?: unknown }).name ?? "").trim() || "Unnamed",
      status: item.status === "failed" ? "failed" : "pending",
      error: item.error ?? null,
    }));
}
