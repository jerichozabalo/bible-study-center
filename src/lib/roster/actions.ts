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
import {
  type GroupFormValues,
  type PersonFormValues,
  formValuesFrom,
  parseGroupForm,
  parsePersonForm,
  personFormValuesFrom,
} from "./form";
import {
  RosterValidationError,
  archiveGroup,
  createGroup,
  setCurrentBook,
  unarchiveGroup,
  updateGroup,
} from "./groups";
import {
  createPerson,
  removePerson,
  restorePerson,
  setSteppedAway,
  updatePerson,
} from "./people";

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
  revalidatePath("/people");
  redirect("/people/groups");
}

/**
 * Advancing a BGroup to the next book (#4/#18) — the confirmation of the
 * checkpoint, not a way past it.
 *
 * It carries form state because the sheet is on the group's own screen and has
 * nowhere to send a refusal: a group archived in another tab has to say so
 * where the button was pressed.
 */
export async function advanceGroupAction(
  _previous: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const bookId = String(formData.get("bookId") ?? "");

  try {
    await setCurrentBook(user.email, id, bookId);
  } catch (thrown) {
    if (thrown instanceof RosterValidationError) return { error: thrown.message };
    throw thrown;
  }

  revalidatePath("/people");
  revalidatePath("/people/groups");
  revalidatePath(`/people/groups/${id}`);
  redirect(`/people/groups/${id}`);
}

/**
 * The way back from an archiving (issue 14). No form state and no confirmation
 * screen: unarchiving is not destructive, so there is nothing to refuse and
 * nothing to ask — one control, one action, same shape as `restorePersonAction`.
 */
export async function unarchiveGroupAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  await unarchiveGroup(user.email, id);

  revalidatePath("/people/groups");
  revalidatePath("/people");
  redirect(`/people/groups/${id}`);
}

/** The same contract for a person: what refused, and what to render again. */
export type PersonFormState = { error?: string; values?: PersonFormValues };

export async function createPersonAction(
  _previous: PersonFormState,
  formData: FormData,
): Promise<PersonFormState> {
  const user = await requireUser();

  let id: string;
  try {
    id = await createPerson(user.email, parsePersonForm(formData));
  } catch (thrown) {
    if (thrown instanceof RosterValidationError) {
      return { error: thrown.message, values: personFormValuesFrom(formData) };
    }
    throw thrown;
  }

  revalidatePath("/people");
  revalidatePath("/people/groups");
  redirect(`/people/${id}`);
}

export async function updatePersonAction(
  _previous: PersonFormState,
  formData: FormData,
): Promise<PersonFormState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  try {
    await updatePerson(user.email, id, parsePersonForm(formData));
  } catch (thrown) {
    if (thrown instanceof RosterValidationError) {
      return { error: thrown.message, values: personFormValuesFrom(formData) };
    }
    throw thrown;
  }

  revalidatePath("/people");
  revalidatePath("/people/groups");
  revalidatePath(`/people/${id}`);
  redirect(`/people/${id}`);
}

/**
 * The three one-tap controls on a person's screen. No form state: none of them
 * can be refused for anything the leader typed, so there is nothing to say
 * back — the screen simply re-renders in its new state.
 */
export async function setSteppedAwayAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  await setSteppedAway(user.email, id, formData.get("steppedAway") === "true");

  revalidatePath("/people");
  revalidatePath(`/people/${id}`);
}

export async function removePersonAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  await removePerson(user.email, id);

  revalidatePath("/people");
  revalidatePath("/people/groups");
  redirect("/people");
}

export async function restorePersonAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  await restorePerson(user.email, id);

  revalidatePath("/people");
  revalidatePath("/people/groups");
  redirect(`/people/${id}`);
}
