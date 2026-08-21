/**
 * Where Google comes back to: `GET /auth/callback?code=…&state=…`.
 *
 * A route handler and not a screen, because everything that happens here is a
 * decision the server makes before any HTML is worth rendering: spend the code,
 * check the address against the allowlist, mint the session cookie, and send
 * the leader on. Nothing on this address is ever seen.
 *
 * Four ways in that are not a successful sign-in, and each lands back on the
 * sign-in screen with a reason it can say in plain English:
 *   - Google refused, or the leader pressed Cancel        → `?error=cancelled`
 *   - the trip cookies are missing or the state disagrees → `?error=expired`
 *   - the exchange failed                                 → `?error=failed`
 *   - the account is not the allowlisted one (#1)         → `?error=not-allowed`
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { isAllowed, parseAllowlist } from "@/lib/auth/allowlist";
import { exchangeCode } from "@/lib/auth/google";
import { SESSION_COOKIE, signSession } from "@/lib/auth/session";
import {
  NEXT_COOKIE,
  PKCE_COOKIE,
  STATE_COOKIE,
  cookieOptions,
  requestOrigin,
} from "@/lib/auth/trip";
import { allowedEmails, googleClientId, googleClientSecret, sessionSecret } from "@/lib/env";
import { sameOriginPath } from "@/lib/safe-path";

// This route reads cookies and hands out a session; nothing about it may ever
// be prerendered or cached.
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const jar = await cookies();

  const back = (error: string) =>
    withNoStore(NextResponse.redirect(new URL(`/signin?error=${error}`, url.origin)));

  if (url.searchParams.get("error")) return back("cancelled");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const verifier = jar.get(PKCE_COOKIE)?.value;
  const expectedState = jar.get(STATE_COOKIE)?.value;

  // The state check is the CSRF defence: without it, anyone could hand the
  // leader a link that signs them into an attacker's Google account.
  if (!code || !state || !verifier || !expectedState || state !== expectedState) {
    return back("expired");
  }

  // The origin has to be read from THIS request's headers, not from
  // `url.origin` — behind Vercel the URL a route handler is handed is the
  // internal one, and Google will only accept the redirect_uri it was given on
  // the way out.
  const origin = await requestOrigin();

  let identity;
  try {
    identity = await exchangeCode({
      code,
      codeVerifier: verifier,
      clientId: googleClientId(),
      clientSecret: googleClientSecret(),
      redirectUri: new URL("/auth/callback", origin).toString(),
    });
  } catch (thrown) {
    // The reason is for whoever reads the log — it names a misconfigured OAuth
    // client, which is the first thing to check if the button stops working —
    // and never for the screen, which would be handing a stranger detail.
    console.warn("[auth/callback] code exchange failed", thrown);
    return back("failed");
  }

  if (!isAllowed(identity.email, parseAllowlist(allowedEmails()))) {
    return back("not-allowed");
  }

  const destination = sameOriginPath(jar.get(NEXT_COOKIE)?.value, "/");
  const response = withNoStore(NextResponse.redirect(new URL(destination, url.origin)));

  response.cookies.set(SESSION_COOKIE, await signSession(identity, sessionSecret()), {
    ...cookieOptions(origin),
    maxAge: 60 * 60 * 24 * 30,
  });

  // The trip is over; the verifier and state must not survive it.
  for (const name of [PKCE_COOKIE, STATE_COOKIE, NEXT_COOKIE]) {
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
  }

  return response;
}

/** A response carrying auth cookies must never be held by a CDN. */
function withNoStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  return response;
}
