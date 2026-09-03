/**
 * The browser transport (#72): each handler turns a queued item into a call to
 * the matching server action in `actions.ts`.
 *
 * This is the only file that knows the shape of each write type's payload. The
 * queue in `queue.ts` treats `type` and `payload` as opaque, so issue 18 adds
 * person and group by adding a handler here and a `type` string at the call
 * site — not by touching the replay loop.
 *
 * The ref pattern (#72's dependency graph): a payload field that names an
 * earlier, still-queued item carries `<thing>Ref` and is resolved to that
 * item's server id at replay time; the plain `<thing>Id` field is a real server
 * id. Exactly one of each pair is set. `meetingRef` (sheet), `groupRef`
 * (meeting) and `homeGroupRef` (person) all work the same way.
 */
import type { Mark } from "../attendance/completions";
import { uploadGroup, uploadMeeting, uploadPerson, uploadSheet } from "./actions";
import type { Transport } from "./queue";
import type { OutboxItem } from "./store";

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

export const MEETING_WRITE = "meeting";
export const SHEET_WRITE = "sheet";
export const GROUP_WRITE = "group";
export const PERSON_WRITE = "person";

export function browserTransport(): Transport {
  return {
    [GROUP_WRITE]: async (ctx) => {
      const payload = ctx.payload as unknown as GroupPayload;
      const { groupId } = await uploadGroup({ clientId: ctx.id, ...payload });
      return { serverId: groupId };
    },
    [PERSON_WRITE]: async (ctx) => {
      const payload = ctx.payload as unknown as PersonPayload;
      const homeGroupId = payload.homeGroupRef
        ? ctx.resolve(payload.homeGroupRef)
        : (payload.homeGroupId ?? null);
      const { personId } = await uploadPerson({ clientId: ctx.id, ...payload, homeGroupId });
      return { serverId: personId };
    },
    [MEETING_WRITE]: async (ctx) => {
      const payload = ctx.payload as unknown as MeetingPayload;
      const groupId = payload.groupRef
        ? ctx.resolve(payload.groupRef)
        : (payload.groupId as string);
      const { meetingId } = await uploadMeeting({ clientId: ctx.id, ...payload, groupId });
      return { serverId: meetingId };
    },
    [SHEET_WRITE]: async (ctx) => {
      const payload = ctx.payload as unknown as SheetPayload;
      const meetingId = payload.meetingRef
        ? ctx.resolve(payload.meetingRef)
        : (payload.meetingId as string);
      await uploadSheet({ meetingId, marks: payload.marks });
    },
  };
}

/** A still-queued offline BGroup, as a form's home-group picker needs it: the
 * queue id to enqueue a ref against, and the name the leader typed. */
export type PendingGroup = { queueId: string; name: string };

/** The offline-created BGroups still waiting to upload — for a create form that
 * has to offer them as home-group options and enqueue a `homeGroupRef` +
 * `deps` against the one that is picked. */
export function pendingGroups(items: OutboxItem[]): PendingGroup[] {
  return items
    .filter((item) => item.type === GROUP_WRITE)
    .map((item) => ({
      queueId: item.id,
      name: String((item.payload as unknown as GroupPayload).name ?? ""),
    }));
}
