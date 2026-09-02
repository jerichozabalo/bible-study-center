"use server";

/**
 * The server half of the outbox transport (#72).
 *
 * The attendance sheet and the new-meeting form post to their own actions when
 * online; these are what the outbox calls instead when the write was queued on
 * the phone and is uploading later. Same modules, same validation — the only
 * difference is that a queued write carries a client id so a retried flush
 * cannot write it twice.
 *
 * Neither redirects: a flush is a loop over several writes, and `redirect`
 * throws. They return the ids the queue needs and nothing else.
 */
import { revalidatePath } from "next/cache";

import { requireUser } from "../auth/guard";
import { type Mark, recordSheet } from "../attendance/completions";
import { createMeeting } from "../meetings/meetings";

export type QueuedMeeting = {
  /** The outbox item's id — the idempotency key (#73's intent). */
  clientId: string;
  groupId: string;
  date: string;
  startTime: string | null;
  durationMinutes: number | null;
  bookId: string | null;
  sessionId: string | null;
  notes: string | null;
  repeatWeekly: boolean;
};

export async function uploadMeeting(input: QueuedMeeting): Promise<{ meetingId: string }> {
  const user = await requireUser();

  const meetingId = await createMeeting(user.email, {
    groupId: input.groupId,
    date: input.date,
    startTime: input.startTime,
    durationMinutes: input.durationMinutes,
    bookId: input.bookId,
    sessionId: input.sessionId,
    notes: input.notes,
    repeatWeekly: input.repeatWeekly,
    clientId: input.clientId,
  });

  revalidatePath("/");
  revalidatePath("/calendar");
  return { meetingId };
}

export type QueuedSheet = {
  meetingId: string;
  marks: { personId: string; mark: Mark | null }[];
};

export async function uploadSheet(input: QueuedSheet): Promise<void> {
  const user = await requireUser();

  // #47: an uploaded sheet is a completed sheet — the leader took attendance in
  // the room, the app just could not reach the server until now.
  await recordSheet(user.email, {
    meetingId: input.meetingId,
    marks: input.marks,
    hold: true,
  });

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath(`/meetings/${input.meetingId}`);
}
