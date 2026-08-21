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
import { parseMeetingForm } from "./form";
import { MeetingValidationError, createMeeting } from "./meetings";

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
