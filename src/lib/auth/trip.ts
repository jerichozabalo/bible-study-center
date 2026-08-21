/**
 * The short-lived state of one trip to Google's consent screen: the PKCE
 * verifier, the CSRF state, and where the leader was headed before they were
 * asked to sign in.
 *
 * Its own module because both ends of the trip need these names — the server
 * action that writes the cookies and the callback route that spends them — and
 * a `"use server"` file may only export async functions, so they cannot live
 * beside the action itself.
 */
import { headers } from "next/headers";

export const PKCE_COOKIE = "bst_pkce";
export const STATE_COOKIE = "bst_state";
export const NEXT_COOKIE = "bst_next";

/** Long enough to sit on the consent screen, short enough to be no use later. */
export const TRIP_SECONDS = 60 * 10;

/**
 * How every cookie this app sets is scoped — the trip's three, and the session.
 *
 * `secure` follows the scheme the request actually arrived on, not
 * `NODE_ENV`. `next start` is production, so keying off the environment set
 * Secure on a plain-http origin, and a browser silently DROPS a Secure cookie
 * there — reaching the app at `http://192.168.1.x:3111` to try it on a real
 * phone would lose the PKCE verifier and fail the callback with nothing to
 * see (QA pass, 2026-08-21). On Vercel the origin is https and the flag is set,
 * which is the case that matters.
 */
export function cookieOptions(origin: string) {
  return {
    httpOnly: true,
    // `lax` and not `strict`: the callback arrives as a top-level navigation
    // from accounts.google.com, and `strict` would withhold exactly the cookies
    // that trip needs.
    sameSite: "lax" as const,
    secure: origin.startsWith("https://"),
    path: "/",
  };
}

/**
 * The origin this request arrived at, from headers alone — never a constant,
 * because local QA and production are different origins and a hardcoded one
 * works in exactly the place it was written for.
 *
 * Pure and exported so it can be tested, and it needs testing: the redirect_uri
 * is derived TWICE in one sign-in — by the server action opening the trip, and
 * again by the callback route spending the code — and Google rejects the
 * exchange unless the two strings are byte-identical. The two legs do not see
 * the same headers. The action's POST carries an `Origin`; the callback is a
 * top-level navigation from accounts.google.com and carries none, leaving only
 * `host` and whatever proxy header sits in front.
 *
 * Which is why the scheme is inferred from the host rather than defaulted to
 * https: behind Vercel there is always an `x-forwarded-proto`, but `next start`
 * on localhost sets none, and defaulting to https there gave the callback
 * `https://localhost:3111` for a trip that had already told Google
 * `http://localhost:3111`. Every local sign-in died on redirect_uri_mismatch.
 */
export function originFrom(source: {
  origin: string | null;
  proto: string | null;
  host: string | null;
}): string {
  if (source.origin) return source.origin;

  const host = source.host ?? "";
  // A proxy chain forwards a comma-separated list; the client-facing one is first.
  const forwarded = source.proto?.split(",")[0]?.trim();
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host);

  return `${forwarded || (isLocal ? "http" : "https")}://${host}`;
}

/** The origin of the request being served, read from its own headers. */
export async function requestOrigin(): Promise<string> {
  const requestHeaders = await headers();
  return originFrom({
    origin: requestHeaders.get("origin"),
    proto: requestHeaders.get("x-forwarded-proto"),
    host: requestHeaders.get("host"),
  });
}

/**
 * Both legs build their redirect_uri as `new URL("/auth/callback", origin)`
 * from `requestOrigin()`. It must also match a redirect URI registered on the
 * OAuth client, so every origin this app is reached at needs an entry there —
 * localhost included.
 */
