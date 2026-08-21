/**
 * `requireUser()` — the one line every screen behind sign-in starts with, and
 * the reason sign-in is not optional (#71).
 *
 * It re-checks the allowlist on every request rather than trusting that the
 * cookie was only ever issued to an allowed address. Removing an address from
 * `ALLOWED_EMAILS` should lock that account out at the next page load, not
 * whenever its thirty-day token happens to expire — that is the only revocation
 * this stateless session has (see `session.ts`).
 */
import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { allowedEmails, sessionSecret } from "../env";
import { isAllowed, parseAllowlist } from "./allowlist";
import { SESSION_COOKIE, type Session, verifySession } from "./session";

/** The session if there is a valid, still-allowed one; null otherwise. */
export async function currentUser(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(token, sessionSecret());
  if (!session) return null;
  if (!isAllowed(session.email, parseAllowlist(allowedEmails()))) return null;
  return session;
}

export async function requireUser(): Promise<Session> {
  const session = await currentUser();
  if (!session) redirect("/signin");
  return session;
}
