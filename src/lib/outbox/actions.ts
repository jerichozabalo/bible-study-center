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
 * throws. They return the ids the queue needs — and, for the roster writes, a
 * refused-write reason handed back as data rather than thrown, because Next
 * redacts a raw server-action throw in production to a useless digest (see
 * `unwrapUpload`). Same catch the online form actions in `roster/actions.ts`
 * already do.
 */
import { revalidatePath } from "next/cache";

import { requireUser } from "../auth/guard";
import { type Mark, recordSheet } from "../attendance/completions";
import { createMeeting } from "../meetings/meetings";
import { RosterValidationError, createGroup } from "../roster/groups";
import { createPerson } from "../roster/people";
import type { UploadResult } from "./pending";

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

/**
 * Person and BGroup creation queued on the phone (#72 as amended 2026-09-02).
 *
 * Same modules and validation as the online forms; the only difference is the
 * `clientId` the queue carries so a retried flush returns the first attempt's
 * row instead of a duplicate. Neither redirects — a flush is a loop.
 */
export type QueuedGroup = {
  clientId: string;
  name: string;
  weekday: number;
  startTime: string;
  durationMinutes: number;
  currentBookId: string | null;
};

export async function uploadGroup(input: QueuedGroup): Promise<UploadResult<"groupId">> {
  const user = await requireUser();

  let groupId: string;
  try {
    groupId = await createGroup(user.email, {
      name: input.name,
      weekday: input.weekday,
      startTime: input.startTime,
      durationMinutes: input.durationMinutes,
      currentBookId: input.currentBookId,
      clientId: input.clientId,
    });
  } catch (thrown) {
    if (thrown instanceof RosterValidationError) return { error: thrown.message };
    throw thrown;
  }

  revalidatePath("/people");
  revalidatePath("/people/groups");
  return { groupId };
}

export type QueuedPerson = {
  clientId: string;
  name: string;
  /** bst-v1.1 issue 1 — required, so a transport that drops it fails the
   * typecheck rather than silently replaying the person without it. */
  nickname: string | null;
  phone: string | null;
  email: string | null;
  homeGroupId: string | null;
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

export async function uploadPerson(input: QueuedPerson): Promise<UploadResult<"personId">> {
  const user = await requireUser();

  let personId: string;
  try {
    personId = await createPerson(user.email, {
      name: input.name,
      nickname: input.nickname,
      phone: input.phone,
      email: input.email,
      homeGroupId: input.homeGroupId,
      joinedOn: input.joinedOn,
      birthday: input.birthday,
      address: input.address,
      civilStatus: input.civilStatus,
      spiritualStatus: input.spiritualStatus,
      baptized: input.baptized,
      baptizedOn: input.baptizedOn,
      invitedBy: input.invitedBy,
      notes: input.notes,
      clientId: input.clientId,
    });
  } catch (thrown) {
    if (thrown instanceof RosterValidationError) return { error: thrown.message };
    throw thrown;
  }

  revalidatePath("/people");
  revalidatePath("/people/groups");
  return { personId };
}
