"use server";

/**
 * The attendance module's server actions — the boundary the sheet posts to.
 *
 * Same three steps as the roster's and the meetings': ask who is signed in
 * (#71, and #32's owner stamp comes from there), hand the form to the module,
 * and turn a validation error into a sentence the sheet can print. Anything
 * else that throws keeps throwing.
 *
 * One form, two submits (#25/#67): "Save attendance" confirms the sheet and is
 * what marks the meeting held (#47); "Save to the roster" adds a walk-in and
 * comes straight back, because the leader is mid-room and has not finished
 * ticking. Both carry every mark on the sheet, so the round trip for a walk-in
 * cannot cost the ticks already made.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "../auth/guard";
import { RosterValidationError } from "../roster/groups";
import { AttendanceValidationError, addWalkIn, recordSheet } from "./completions";
import { parseSheetForm } from "./form";

export type SheetFormState = { error?: string };

export async function saveSheetAction(
  _previous: SheetFormState,
  formData: FormData,
): Promise<SheetFormState> {
  const user = await requireUser();
  const form = parseSheetForm(formData);

  try {
    if (form.walkIn !== null) {
      // The ticks first, so they survive the round trip, and the new person
      // second — `addWalkIn` marks them attended itself.
      await recordSheet(user.email, {
        meetingId: form.meetingId,
        marks: form.marks,
        hold: false,
      });
      await addWalkIn(user.email, form.meetingId, form.walkIn);

      revalidatePath(`/meetings/${form.meetingId}`);
      revalidatePath("/people");
      // No redirect: the sheet re-renders with them on it, still open.
      return {};
    }

    // #47 — the deliberate act. This is the only place a meeting becomes held.
    await recordSheet(user.email, {
      meetingId: form.meetingId,
      marks: form.marks,
      hold: true,
    });
  } catch (thrown) {
    if (thrown instanceof AttendanceValidationError || thrown instanceof RosterValidationError) {
      return { error: thrown.message };
    }
    throw thrown;
  }

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath(`/meetings/${form.meetingId}`);
  // Outside the try: `redirect` works by throwing, and catching it here would
  // turn a saved sheet into "something went wrong". Home is where the meeting
  // now reads as held.
  redirect("/");
}
