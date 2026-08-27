"use server";

/**
 * Server actions for the calendar page (issue 5).
 *
 * Each one follows the roster's three-step dance: ask who is signed in (#32),
 * hand the work to the module, revalidate the paths that need to re-render.
 * `CalendarError` is a user-facing mistake ("that meeting was held — it cannot
 * be cancelled") and comes back as a sentence; a dropped connection or a
 * broken transaction is not, and it keeps throwing.
 *
 * These are plain Server Actions (not `useFormState`): a `<form action={...}>`
 * POSTs `FormData` as the single argument, and revalidation via
 * `revalidatePath` is how the page picks up the new state on the next render.
 */
import { revalidatePath } from "next/cache";

import { requireUser } from "../auth/guard";
import { CalendarError, cancelMeeting, materializeGhost, resolveMeeting } from "./calendar";

/**
 * The one-tap resolve for a past-due proposed meeting (#52).
 * The form posts the group id, the local date, and which direction ("held"
 * or "cancelled") the leader chose.
 */
export async function resolveMeetingAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const groupId = String(formData.get("groupId") ?? "");
  const date = String(formData.get("date") ?? "");
  const status = (formData.get("status") as "held" | "cancelled") ?? "held";

  try {
    await resolveMeeting(user.email, groupId, date, status);
  } catch (thrown) {
    if (thrown instanceof CalendarError) {
      // Re-throw as a plain Error with the user-facing message — in a full
      // build this would surface in the UI, here it surfaces in the server log.
      throw new Error(thrown.message);
    }
    throw thrown;
  }

  revalidatePath("/calendar");
}

/**
 * Cancel a meeting — a forward action for any proposed night, not just past-due
 * ones (#50). The form posts the group id and the local date.
 */
export async function cancelMeetingAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const groupId = String(formData.get("groupId") ?? "");
  const date = String(formData.get("date") ?? "");

  try {
    await cancelMeeting(user.email, groupId, date);
  } catch (thrown) {
    if (thrown instanceof CalendarError) {
      throw new Error(thrown.message);
    }
    throw thrown;
  }

  revalidatePath("/calendar");
}

/**
 * Tap a ghost slot beyond the 8-week horizon (#49). The ghost is drawn from the
 * group's schedule, not stored; tapping it materialises exactly that one
 * meeting — `origin = 'generated'`, still PROPOSED (#47) — on the same terms as
 * the #7 materialiser, and is idempotent (#73), so a double-tap or a retry
 * writes one row. The form posts the group id and the local date.
 */
export async function materializeGhostAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const groupId = String(formData.get("groupId") ?? "");
  const date = String(formData.get("date") ?? "");

  try {
    await materializeGhost(user.email, groupId, date);
  } catch (thrown) {
    if (thrown instanceof CalendarError) {
      throw new Error(thrown.message);
    }
    throw thrown;
  }

  revalidatePath("/calendar");
}
