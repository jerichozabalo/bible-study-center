"use server";

/**
 * The meetings module's server actions — the boundary the [+] screen posts to.
 *
 * Same three steps as the roster's: ask who is signed in (#71, and #32's owner
 * stamp comes from there), hand the form to the module, and turn a
 * `MeetingValidationError` into a sentence the form can print. Anything else
 * that throws keeps throwing.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "../auth/guard";
import { removePhotosForMeeting } from "../session-photos/photos";
import { parseMeetingEditForm, parseMeetingForm } from "./form";
import {
  MeetingValidationError,
  changeMeetingSession,
  createMeeting,
  deleteMeeting,
  updateMeeting,
} from "./meetings";

/**
 * No `values` half, unlike the group form: the new-meeting screen keeps the
 * picked group, date, session and toggles in client state, and a refusal
 * re-renders that component rather than remounting it.
 */
export type MeetingFormState = { error?: string };

export async function createMeetingAction(
  _previous: MeetingFormState,
  formData: FormData,
): Promise<MeetingFormState> {
  const user = await requireUser();

  try {
    await createMeeting(user.email, parseMeetingForm(formData));
  } catch (thrown) {
    if (thrown instanceof MeetingValidationError) return { error: thrown.message };
    throw thrown;
  }

  revalidatePath("/");
  revalidatePath("/calendar");
  // Outside the try: `redirect` works by throwing, and catching it here would
  // turn a saved meeting into "something went wrong". Home is where the new
  // meeting is immediately visible until the calendar lands (issue 5).
  redirect("/");
}

/**
 * The COVERING panel's "Change" pill. A plain Server Action, the same shape
 * `calendar-actions.ts` uses: the form posts `meetingId` and `sessionId`
 * (empty string for "no lesson tonight"), and revalidation is how the
 * attendance sheet picks up the correction on its next render.
 */
export async function changeMeetingSessionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const meetingId = String(formData.get("meetingId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "") || null;

  try {
    await changeMeetingSession(user.email, meetingId, sessionId);
  } catch (thrown) {
    if (thrown instanceof MeetingValidationError) {
      throw new Error(thrown.message);
    }
    throw thrown;
  }

  revalidatePath(`/meetings/${meetingId}`);
}

/**
 * The Edit screen (#75, 2026-09-17): date, time, duration and notes, whatever
 * the meeting's status. Book and session stay `changeMeetingSessionAction`'s.
 */
export async function updateMeetingAction(
  _previous: MeetingFormState,
  formData: FormData,
): Promise<MeetingFormState> {
  const user = await requireUser();
  const meetingId = String(formData.get("meetingId") ?? "");

  try {
    await updateMeeting(user.email, meetingId, parseMeetingEditForm(formData));
  } catch (thrown) {
    if (thrown instanceof MeetingValidationError) return { error: thrown.message };
    throw thrown;
  }

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath(`/meetings/${meetingId}`);
  redirect(`/meetings/${meetingId}`);
}

/**
 * The Delete screen's confirm (#75, 2026-09-17). Removes the meeting's R2
 * photo objects first — `deleteMeeting`'s cascade only reaches the database —
 * then the meeting itself, whatever its status.
 */
export async function deleteMeetingAction(
  _previous: MeetingFormState,
  formData: FormData,
): Promise<MeetingFormState> {
  const user = await requireUser();
  const meetingId = String(formData.get("meetingId") ?? "");

  try {
    await removePhotosForMeeting(user.email, meetingId);
    await deleteMeeting(user.email, meetingId);
  } catch (thrown) {
    if (thrown instanceof MeetingValidationError) return { error: thrown.message };
    throw thrown;
  }

  revalidatePath("/");
  revalidatePath("/calendar");
  // Outside the try: the meeting is gone, so there is no page left to stay on
  // or re-render an error into.
  redirect("/");
}
