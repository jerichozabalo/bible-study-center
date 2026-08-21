/**
 * Signing out: clear the cookie, go to the front door.
 *
 * A POST, not a link. A GET here would be a URL any image tag on any page could
 * fire, and the leader would be signed out mid-meeting by a page they visited.
 */
import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const response = NextResponse.redirect(new URL("/signin", new URL(request.url).origin), {
    // 303: turn the POST into a GET for the redirect, or the browser re-posts
    // to the sign-in screen.
    status: 303,
  });
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
