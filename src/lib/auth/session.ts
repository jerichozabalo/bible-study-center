/**
 * The session: a signed JWT in an HttpOnly cookie, and nothing in the database.
 *
 * v1 has one account (#1), so a session table would hold exactly one row whose
 * only job is to say "still Jericho" — a round-trip to Neon on every request,
 * on a connection that autosuspends, to learn something the cookie already
 * proves. The identity Google vouched for at sign-in IS the session; the secret
 * is what makes it unforgeable.
 *
 * The trade is that signing out cannot be enforced server-side before the
 * token expires: clearing the cookie is the browser forgetting, not the server
 * refusing. For a single-user tool on the leader's own phone — which issue 12
 * puts a PIN in front of anyway — that is the right side of the trade. It stops
 * being right the day a second person has an account, and that is v1.1's
 * problem to solve with a real session store.
 */
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "bst_session";

/** Thirty days: long enough that the leader is not re-consenting every week. */
const DEFAULT_EXPIRY_SECONDS = 60 * 60 * 24 * 30;

export type Session = {
  email: string;
  name?: string;
};

function keyFrom(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signSession(
  session: Session,
  secret: string,
  options: { expiresInSeconds?: number } = {},
): Promise<string> {
  const expiresIn = options.expiresInSeconds ?? DEFAULT_EXPIRY_SECONDS;
  const now = Math.floor(Date.now() / 1000);

  const claims: Record<string, unknown> = { email: session.email };
  if (session.name !== undefined) claims.name = session.name;

  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    // Seconds, not a duration string, so a test can hand back a token that is
    // already past without waiting for it.
    .setExpirationTime(now + expiresIn)
    .sign(keyFrom(secret));
}

/**
 * Null for every way a token can fail — wrong secret, tampered, expired,
 * not a JWT at all. The caller's job is the same in each case (show the
 * sign-in screen), and a thrown error here would only invite a `catch` that
 * treats one of those cases as success.
 */
export async function verifySession(
  token: string | undefined | null,
  secret: string,
): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, keyFrom(secret), { algorithms: ["HS256"] });
    if (typeof payload.email !== "string" || payload.email.length === 0) return null;

    const session: Session = { email: payload.email };
    if (typeof payload.name === "string") session.name = payload.name;
    return session;
  } catch {
    return null;
  }
}
