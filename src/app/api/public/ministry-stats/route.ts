/**
 * `GET /api/public/ministry-stats` — the four public numbers
 * (ministry-support-site issue 2).
 *
 * The only unauthenticated answer in the app, and deliberately so: it returns
 * four integers and nothing else, which is why it is allowed out from behind
 * #71's sign-in. **Do not add `requireUser()` here** — the support site reads
 * this with no credentials, and there is no plan for that to change. The guard
 * against it going wrong is the shape, not a session: `getMinistryStats` owns
 * the contract and its test fails if a fifth field ever appears.
 *
 * The response carries no `Cache-Control` on purpose. Freshness belongs to the
 * consuming site, which revalidates hourly; a header here would only fight it.
 * `force-dynamic` is not caching — it keeps the build from prerendering the
 * numbers into a static file that would never change again.
 *
 * Thin by design, like every route handler here: resolve the owner, run the
 * query, serialise it unchanged.
 */
import { NextResponse } from "next/server";

import { getMinistryStats, ministryOwnerId } from "@/lib/insights/public-stats";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const ownerId = ministryOwnerId();
  if (!ownerId) {
    // Four zeros would be a lie on a public page, and this is the same reading
    // `lib/env.ts` takes of a missing variable: a deployment that is not
    // finished should say so in those words.
    return new Response(
      "ALLOWED_EMAILS is not set, so there is no ministry to count. " +
        "See .env.example for what this deployment still needs.",
      { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  return NextResponse.json(await getMinistryStats(ownerId));
}
