"use server";

/**
 * The roster's server actions — the boundary the Groups screens post to.
 *
 * Each one does the same three things and nothing else: ask who is signed in
 * (#71, and the owner stamp of #32 comes from there), hand the form to the
 * module, and turn a `RosterValidationError` into a sentence the form can
 * print. Anything else that throws keeps throwing: a dropped connection is not
 * a validation message and must not be dressed as one.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "../auth/guard";
import { type GroupFormValues, formValuesFrom, parseGroupForm } from "./form";
import { RosterValidationError, archiveGroup, createGroup, updateGroup } from "./groups";

/**
 * `values` is what the form re-renders from after a refusal. Without it the
 * four fields the leader already chose fall back to defaults and have to be
 * picked again, which turns a typo in the name into re-entering the whole form
 * (QA pass, 2026-08-21).
 */
export type GroupFormState = { error?: string; values?: GroupFormValues };

export async function createGroupAction(
  _previous: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const user = await requireUser();

  let id: string;
  try {
    id = await createGroup(user.email, parseGroupForm(formData));
  } catch (thrown) {
    if (thrown instanceof RosterValidationError) {
      return { error: thrown.message, values: formValuesFrom(formData) };
    }
    throw thrown;
  }

  revalidatePath("/people/groups");
  // Outside the try: `redirect` works by throwing, and catching it here would
  // turn a successful save into "something went wrong".
  redirect(`/people/groups/${id}`);
}

export async function updateGroupAction(
  _previous: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  try {
    await updateGroup(user.email, id, parseGroupForm(formData));
  } catch (thrown) {
    if (thrown instanceof RosterValidationError) {
      return { error: thrown.message, values: formValuesFrom(formData) };
    }
    throw thrown;
  }

  revalidatePath("/people/groups");
  revalidatePath(`/people/groups/${id}`);
  redirect(`/people/groups/${id}`);
}

export async function archiveGroupAction(
  _previous: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const moveMembersToGroupId = String(formData.get("moveMembersToGroupId") ?? "") || null;

  try {
    await archiveGroup(user.email, id, { moveMembersToGroupId });
  } catch (thrown) {
    if (thrown instanceof RosterValidationError) return { error: thrown.message };
    throw thrown;
  }

  revalidatePath("/people/groups");
  redirect("/people/groups");
}
