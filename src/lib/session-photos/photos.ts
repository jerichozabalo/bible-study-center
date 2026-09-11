/**
 * Session photos (bst-v1.1 issue 4) — the archive that builds itself.
 *
 * Every meeting record can carry photos: taken in the room or uploaded later.
 * Three rules come straight from the grilled spec and are enforced here, not in
 * the UI:
 *
 * 1. **No consent tick, no batch.** The leader gets verbal consent when the
 *    photo is taken; the tick records that the moment happened. A batch
 *    without it is refused outright (`ConsentRequiredError`) — the safeguard is
 *    a recorded claim, not a per-photo switch (there is deliberately NO
 *    per-photo public/private toggle; do not reintroduce one).
 * 2. **Two variants.** The archive copy and the thumbnail the public site will
 *    request (ministry-support-site issue 11) are written together, under
 *    `sessions/<group>/<date>/<uuid>.jpg`, so the pair can never drift apart.
 * 3. **Delete really deletes** — the row and both objects. Consent can be
 *    withdrawn, and the site drops the photo on its next revalidate. #24's
 *    tombstone doctrine is about attendance records; this is an image.
 *
 * Ownership: every statement is owner-scoped, which in v1 is the whole rule
 * (#1). When v1.1 leader accounts arrive, the check that "only Jericho may
 * upload/delete for the public flow" belongs at `assertPhotoManager` below —
 * it is deliberately one function so it has one place to tighten.
 */
import { randomUUID } from "node:crypto";

import { isCalendarDate } from "../dates";
import { query } from "../db";
import { getMeeting } from "../meetings/meetings";
import { type PhotoStorage, r2Storage } from "./storage";

/** A batch arrived without the consent tick — nothing was stored. */
export class ConsentRequiredError extends Error {
  constructor() {
    super("Tick the consent box before uploading — these photos are used on the website.");
    this.name = "ConsentRequiredError";
  }
}

/** One prepared photo: the archive copy, its thumbnail, and what they say. */
export type PhotoUploadFile = {
  /** The archive copy — already downscaled in the browser (see `downscale.ts`). */
  photo: Uint8Array;
  /** The small variant the public site will request. */
  thumb: Uint8Array;
  caption: string | null;
  /** The day the photo was taken, `YYYY-MM-DD` (#56). */
  takenOn: string;
};

export type SessionPhoto = {
  id: string;
  meetingId: string;
  caption: string | null;
  takenOn: string;
  /** The moment the batch's consent tick was recorded. */
  consentConfirmedAt: Date;
  /** The archive copy's key in R2. */
  r2Key: string;
  /** The public variant's key — always `<r2Key without .jpg>-thumb.jpg`. */
  r2ThumbKey: string;
  createdAt: Date;
};

/** A photo with the URLs a screen can draw — signed, short-lived. */
export type SignedPhoto = {
  id: string;
  caption: string | null;
  takenOn: string;
  thumbUrl: string;
  photoUrl: string;
};

type PhotoRow = {
  id: string;
  meeting_id: string;
  caption: string | null;
  taken_on: string;
  consent_confirmed_at: Date;
  r2_key: string;
  r2_thumb_key: string;
  created_at: Date;
};

function toPhoto(row: PhotoRow): SessionPhoto {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    caption: row.caption,
    takenOn: row.taken_on,
    consentConfirmedAt: row.consent_confirmed_at,
    r2Key: row.r2_key,
    r2ThumbKey: row.r2_thumb_key,
    createdAt: row.created_at,
  };
}

/**
 * v1.1 leader accounts land here: only Jericho may upload/delete for the
 * public flow. In v1 the owner scope on every statement IS the check (#1).
 */
function assertPhotoManager(ownerId: string): void {
  // Intentionally empty in v1: with a single owner (#1), the owner scope on
  // every statement IS the check. Referenced so the seam is real, not decorative.
  void ownerId;
}

/**
 * Store a batch of photos on a meeting. Refused outright without the tick.
 *
 * Keys are shaped `sessions/<group>/<date>/<uuid>.jpg` from the MEETING's group
 * and date — the session is the folder, so everything about one night sits
 * together no matter when it was uploaded.
 */
export async function uploadPhotos(
  ownerId: string,
  meetingId: string,
  files: PhotoUploadFile[],
  consentConfirmed: boolean,
  storage: PhotoStorage = r2Storage(),
): Promise<SessionPhoto[]> {
  assertPhotoManager(ownerId);

  if (!consentConfirmed) throw new ConsentRequiredError();
  if (files.length === 0) return [];

  const meeting = await getMeeting(ownerId, meetingId);
  if (!meeting) throw new Error("That meeting is not on your list.");

  const consentAt = new Date();
  const stored: SessionPhoto[] = [];

  for (const file of files) {
    if (!isCalendarDate(file.takenOn)) {
      throw new Error("Check the photo's date — pick it from the calendar.");
    }
    if (file.photo.byteLength === 0 || file.thumb.byteLength === 0) {
      throw new Error("That photo came through empty — try it again.");
    }

    const uuid = randomUUID();
    const r2Key = `sessions/${meeting.groupId}/${meeting.date}/${uuid}.jpg`;
    const r2ThumbKey = `sessions/${meeting.groupId}/${meeting.date}/${uuid}-thumb.jpg`;

    // Objects first, then the row: a failed write leaves a private orphan, but
    // never a row that points at nothing.
    await storage.put(r2Key, file.photo, "image/jpeg");
    await storage.put(r2ThumbKey, file.thumb, "image/jpeg");

    const rows = await query<PhotoRow>(
      `INSERT INTO session_photos
         (owner_id, meeting_id, caption, taken_on, consent_confirmed_at, r2_key, r2_thumb_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, meeting_id, caption, taken_on::text AS taken_on, consent_confirmed_at,
                 r2_key, r2_thumb_key, created_at`,
      [ownerId, meeting.id, file.caption, file.takenOn, consentAt, r2Key, r2ThumbKey],
    );
    stored.push(toPhoto(rows[0]));
  }

  return stored;
}

/** A session's photos, newest first — the order the record wants them in. */
export async function listPhotosForSession(
  ownerId: string,
  meetingId: string,
): Promise<SessionPhoto[]> {
  const rows = await query<PhotoRow>(
    `SELECT id, meeting_id, caption, taken_on::text AS taken_on, consent_confirmed_at,
            r2_key, r2_thumb_key, created_at
       FROM session_photos
      WHERE owner_id = $1 AND meeting_id = $2
      ORDER BY taken_on DESC, created_at DESC`,
    [ownerId, meetingId],
  );
  return rows.map(toPhoto);
}

/**
 * Delete a photo: the row first (so the public read path loses it), then both
 * objects. Returns false when the photo is not this owner's — the same
 * not-found and not-yours answer, deliberately.
 */
export async function deletePhoto(
  ownerId: string,
  id: string,
  storage: PhotoStorage = r2Storage(),
): Promise<boolean> {
  assertPhotoManager(ownerId);

  const rows = await query<{ r2_key: string; r2_thumb_key: string }>(
    `DELETE FROM session_photos
      WHERE owner_id = $1 AND id = $2
      RETURNING r2_key, r2_thumb_key`,
    [ownerId, id],
  );
  if (rows.length === 0) return false;

  await storage.remove([rows[0].r2_key, rows[0].r2_thumb_key]);
  return true;
}

/** Sign a screen's worth of photos for display. */
export async function signPhotoUrls(
  photos: SessionPhoto[],
  storage: PhotoStorage = r2Storage(),
): Promise<SignedPhoto[]> {
  return await Promise.all(
    photos.map(async (photo) => ({
      id: photo.id,
      caption: photo.caption,
      takenOn: photo.takenOn,
      thumbUrl: await storage.signedUrl(photo.r2ThumbKey),
      photoUrl: await storage.signedUrl(photo.r2Key),
    })),
  );
}
