/**
 * Who is allowed in. v1 is single-user (#1): one Google account — Jericho's —
 * and a plain English refusal for everyone else.
 *
 * A list rather than a single address because the shape costs nothing now and
 * is what v1.1's leader accounts grow out of; the deployment still sets exactly
 * one. Kept apart from `session.ts` and `google.ts` because it is the one piece
 * of the sign-in path that is pure policy, and policy is the part worth being
 * able to read in a test without a token or a network round-trip in the way.
 */
export function parseAllowlist(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

export function isAllowed(email: string | undefined | null, allowlist: string[]): boolean {
  if (!email) return false;
  // An empty allowlist is a misconfigured deployment — env var missing, or a
  // typo'd name. The safe reading of "nobody is listed" is nobody, and the app
  // failing closed is a locked-out leader; failing open is an open roster.
  if (allowlist.length === 0) return false;
  return allowlist.includes(email.trim().toLowerCase());
}
