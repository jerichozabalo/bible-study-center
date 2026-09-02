/**
 * The browser transport (#72): each handler turns a queued item into a call to
 * the matching server action in `actions.ts`.
 *
 * This is the only file that knows the shape of each write type's payload. The
 * queue in `queue.ts` treats `type` and `payload` as opaque, so issue 18 adds
 * person and group by adding a handler here and a `type` string at the call
 * site — not by touching the replay loop.
 */
import type { Mark } from "../attendance/completions";
import { uploadMeeting, uploadSheet } from "./actions";
import type { Transport } from "./queue";

/** What the new-meeting form enqueues. */
export type MeetingPayload = {
  groupId: string;
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

export const MEETING_WRITE = "meeting";
export const SHEET_WRITE = "sheet";

export function browserTransport(): Transport {
  return {
    [MEETING_WRITE]: async (ctx) => {
      const payload = ctx.payload as unknown as MeetingPayload;
      const { meetingId } = await uploadMeeting({ clientId: ctx.id, ...payload });
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
