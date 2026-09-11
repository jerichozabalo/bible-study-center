"use server";

/**
 * The two server actions the photos card calls (bst-v1.1 issue 4).
 *
 * One photo per request, deliberately: the browser has already downscaled the
 * pair (`downscale.ts`), and a per-file request keeps every body comfortably
 * under the request cap no matter how many photos a batch carries — the UI
 * loops, and a single failure fails one row instead of the batch.
 *
 * Errors come back as data, never as throws: a thrown server action reaches the
 * browser as a redacted framework error in a production build (the failed-row
 * lesson from issue 18), and the leader should read the actual sentence.
 */
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/guard";
import { isCalendarDate } from "@/lib/dates";
import { ConsentRequiredError, deletePhoto, uploadPhotos } from "./photos";
import { isStorageConfigured } from "./storage";

export type PhotoActionState = {
  error?: string;
  uploaded?: number;
  deleted?: boolean;
};

/** Generous for a ≤2048px q0.88 JPEG; a bigger one is not what the browser made. */
const MAX_VARIANT_BYTES = 2_500_000;

export async function uploadPhotoAction(formData: FormData): Promise<PhotoActionState> {
  const user = await requireUser();
  if (!isStorageConfigured()) {
    return { error: "Photo storage is not set up yet — the R2 keys are missing." };
  }

  const meetingId = String(formData.get("meetingId") ?? "");
  const caption = String(formData.get("caption") ?? "").trim() || null;
  const takenOn = String(formData.get("takenOn") ?? "");
  const consent = formData.get("consent") === "on";
  const photo = formData.get("photo");
  const thumb = formData.get("thumb");

  if (!(photo instanceof File) || !(thumb instanceof File)) {
    return { error: "That photo did not arrive — try it again." };
  }
  if (!isCalendarDate(takenOn)) {
    return { error: "Pick the day the photo was taken." };
  }
  if (photo.size > MAX_VARIANT_BYTES || thumb.size > MAX_VARIANT_BYTES) {
    return { error: "That photo is too large — try a smaller one." };
  }

  try {
    await uploadPhotos(
      user.email,
      meetingId,
      [
        {
          photo: new Uint8Array(await photo.arrayBuffer()),
          thumb: new Uint8Array(await thumb.arrayBuffer()),
          caption,
          takenOn,
        },
      ],
      consent,
    );
  } catch (error) {
    if (error instanceof ConsentRequiredError) return { error: error.message };
    return { error: error instanceof Error ? error.message : "The photo could not be uploaded." };
  }

  revalidatePath(`/meetings/${meetingId}`);
  return { uploaded: 1 };
}

export async function deletePhotoAction(formData: FormData): Promise<PhotoActionState> {
  const user = await requireUser();
  const photoId = String(formData.get("photoId") ?? "");
  const meetingId = String(formData.get("meetingId") ?? "");

  try {
    const deleted = await deletePhoto(user.email, photoId);
    revalidatePath(`/meetings/${meetingId}`);
    return { deleted };
  } catch {
    return { error: "The photo could not be deleted — try it again." };
  }
}
