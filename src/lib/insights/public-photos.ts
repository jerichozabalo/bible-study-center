/**
 * The public photos feed (ministry-support-site issue 11) — the second half
 * of the unauthenticated `public-stats` boundary started in issue 2.
 *
 * Every row in `session_photos` is already public-eligible: `uploadPhotos`
 * (session-photos/photos.ts) refuses a batch outright without the consent
 * tick, so there is no per-photo flag to check here — the table itself is the
 * allow-list. What this module still has to guard, the same way
 * `public-stats.ts` does:
 *
 * 1. **The shape is the contract.** `{url, caption, date}` and nothing else —
 *    no meeting id, no group id, no group name, no attendee data. The route's
 *    test asserts the exact key set.
 * 2. **One leader's ministry.** Owner comes from `ministryOwnerId()`, never
 *    from the request.
 * 3. **Deleted means gone.** `deletePhoto` removes the row first, so the next
 *    call here simply never sees it — no tombstone, no soft-delete to filter.
 *
 * URLs are signed (the bucket is private — session-photos/storage.ts), with a
 * TTL long enough to outlive the support site's hourly ISR revalidate window
 * rather than the 300s default the logged-in screens use: a shorter TTL would
 * mean an image works for the first few minutes after each revalidate and
 * breaks for the rest of the hour.
 */
import { query } from "../db";
import { type PhotoStorage, r2Storage } from "../session-photos/storage";

export type PublicPhoto = {
  url: string;
  caption: string | null;
  date: string;
};

export type PublicPhotosPage = {
  photos: PublicPhoto[];
  cursor: string | null;
};

const PAGE_SIZE = 12;

/** Outlives the site's hourly ISR revalidate, plus margin for a slow build. */
const PUBLIC_PHOTO_URL_TTL_SECONDS = 3900;

type CursorParts = { createdAt: string; id: string };

function encodeCursor(parts: CursorParts): string {
  return Buffer.from(JSON.stringify(parts)).toString("base64url");
}

/** A malformed or tampered cursor is treated as "start over", never a 500. */
function decodeCursor(cursor: string): CursorParts | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf-8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as CursorParts).createdAt === "string" &&
      typeof (parsed as CursorParts).id === "string"
    ) {
      return parsed as CursorParts;
    }
    return null;
  } catch {
    return null;
  }
}

type Row = {
  id: string;
  caption: string | null;
  taken_on: string;
  created_at: Date;
  r2_thumb_key: string;
};

/**
 * One page of the public archive, newest-uploaded-first. One request, one
 * query for the rows, then one signed URL per photo.
 */
export async function getPublicPhotos(
  ownerId: string,
  cursor: string | null,
  storage: PhotoStorage = r2Storage(),
): Promise<PublicPhotosPage> {
  const after = cursor ? decodeCursor(cursor) : null;

  const rows = after
    ? await query<Row>(
        `SELECT id, caption, taken_on::text AS taken_on, created_at, r2_thumb_key
           FROM session_photos
          WHERE owner_id = $1 AND (created_at, id) < ($2::timestamptz, $3::uuid)
          ORDER BY created_at DESC, id DESC
          LIMIT $4`,
        [ownerId, after.createdAt, after.id, PAGE_SIZE + 1],
      )
    : await query<Row>(
        `SELECT id, caption, taken_on::text AS taken_on, created_at, r2_thumb_key
           FROM session_photos
          WHERE owner_id = $1
          ORDER BY created_at DESC, id DESC
          LIMIT $2`,
        [ownerId, PAGE_SIZE + 1],
      );

  const hasMore = rows.length > PAGE_SIZE;
  const page = rows.slice(0, PAGE_SIZE);

  const photos = await Promise.all(
    page.map(async (row) => ({
      url: await storage.signedUrl(row.r2_thumb_key, PUBLIC_PHOTO_URL_TTL_SECONDS),
      caption: row.caption,
      date: row.taken_on,
    })),
  );

  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor({ createdAt: last.created_at.toISOString(), id: last.id })
      : null;

  return { photos, cursor: nextCursor };
}
