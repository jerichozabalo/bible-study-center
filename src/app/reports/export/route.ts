/**
 * `GET /reports/export?report=person|group|rollup` — the CSV Export (#21/#66).
 *
 * A route handler and not a screen: it authenticates, runs the derivation, and
 * streams the bytes back as a download. Nothing here is ever rendered.
 *
 * It sits behind the same sign-in as every page (#71) — the `(shell)` layout's
 * `requireUser()` does not reach a route handler, so the check is explicit here.
 * An unauthenticated request lands on the front door, not on a file.
 *
 * "Export" is the only word for this (#66). There is no share, send, or
 * external-recipient path and there is not meant to be one (#21).
 */
import { NextResponse } from "next/server";

import { currentUser } from "@/lib/auth/guard";
import { manilaToday } from "@/lib/dates";
import {
  getGroupReport,
  getPersonReport,
  getRollup,
  groupReportToCsv,
  personReportToCsv,
  rollupToCsv,
} from "@/lib/insights/reports";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);

  const user = await currentUser();
  if (!user) {
    return withNoStore(NextResponse.redirect(new URL("/signin", url.origin)));
  }

  const params = url.searchParams;
  const report = params.get("report");

  let csv: string;
  let slug: string;

  if (report === "person") {
    const data = await getPersonReport(user.email, params.get("person") ?? "");
    if (!data) return missing();
    csv = personReportToCsv(data);
    slug = "person";
  } else if (report === "group") {
    const data = await getGroupReport(user.email, params.get("group") ?? "");
    if (!data) return missing();
    csv = groupReportToCsv(data);
    slug = "group";
  } else if (report === "rollup") {
    csv = rollupToCsv(await getRollup(user.email));
    slug = "rollup";
  } else {
    return missing();
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bible-study-tayo-${slug}-${manilaToday()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

function missing(): Response {
  return new Response("That report is not available.", {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

function withNoStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  return response;
}
