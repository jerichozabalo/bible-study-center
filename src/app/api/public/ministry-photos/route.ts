/**
 * `GET /api/public/ministry-photos?cursor=` — the public photo feed
 * (ministry-support-site issue 11).
 *
 * Unauthenticated, same as `/api/public/ministry-stats` and for the same
 * reason: the shape is the guard, not a session. `getPublicPhotos` owns the
 * contract — `{url, caption, date}` per photo, plus a cursor — and its test
 * fails if a fifth field, a meeting id, or a group name ever reaches this
 * response.
 *
 * No `Cache-Control` here; the support site's ISR revalidate owns freshness.
 */
import { NextResponse } from "next/server";

import { getPublicPhotos } from "@/lib/insights/public-photos";
import { ministryOwnerId } from "@/lib/insights/public-stats";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const ownerId = ministryOwnerId();
  if (!ownerId) {
    return new Response(
      "ALLOWED_EMAILS is not set, so there is no ministry to show. " +
        "See .env.example for what this deployment still needs.",
      { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  const cursor = new URL(request.url).searchParams.get("cursor");
  return NextResponse.json(await getPublicPhotos(ownerId, cursor));
}
