/**
 * The browser transport (#72): each handler turns a queued item into a call to
 * the matching server action in `actions.ts`.
 *
 * This is the only file that knows the shape of each write type's payload. The
 * queue in `queue.ts` treats `type` and `payload` as opaque, so issue 18 adds
 * person and group by adding a handler here and a `type` string at the call
 * site — not by touching the replay loop.
 *
 * The write-type constants, the payload types and the pure queue views
 * (`pendingGroups`, `pendingRosterRows`) live in `./pending` — that module has
 * no server imports, so a form, a list and a node test can all read it without
 * pulling in `server-only` through `actions.ts`. Re-exported here for the call
 * sites that have always imported them from `transport`.
 */
import { uploadGroup, uploadMeeting, uploadPerson, uploadSheet } from "./actions";
import {
  GROUP_WRITE,
  type GroupPayload,
  MEETING_WRITE,
  type MeetingPayload,
  PERSON_WRITE,
  type PersonPayload,
  SHEET_WRITE,
  type SheetPayload,
} from "./pending";
import type { Transport } from "./queue";

export {
  GROUP_WRITE,
  MEETING_WRITE,
  PERSON_WRITE,
  SHEET_WRITE,
  pendingGroups,
  pendingRosterRows,
} from "./pending";
export type {
  GroupPayload,
  MeetingPayload,
  PendingGroup,
  PendingRosterRow,
  PersonPayload,
  SheetPayload,
} from "./pending";

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
