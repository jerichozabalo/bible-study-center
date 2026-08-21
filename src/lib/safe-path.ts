/**
 * Narrow an untrusted `next=` value to an on-site path, or a caller's fallback.
 *
 * The Google callback is the only place in this app that redirects to a
 * user-supplied destination, and it does so holding a freshly-minted session
 * cookie. An off-site value would carry the leader to wherever a stranger chose
 * at exactly the moment they are signed in.
 *
 * The obvious guard — `startsWith("/") && !startsWith("//")` — reads the
 * string, but the redirect does not: it hands the value to the WHATWG URL
 * parser, which normalises `\` to `/` and strips ASCII tab and newline BEFORE
 * resolving an origin. `/\evil.tld` and `/⇥/evil.tld` both pass the string
 * guard and land on `https://evil.tld/`. That is a real finding, fixed in
 * OurChurch on 2026-08-19 and carried here rather than re-learned.
 *
 * So decide with the same parser the redirect will use: resolve against a
 * synthetic base and keep the value only if it lands back on that base — which
 * no `//host`, `/\host`, absolute URL, or `javascript:`/`data:` scheme can. The
 * base is thrown away; only `pathname + search + hash` comes back, so the
 * result is always relative to wherever it is finally used.
 */
const SYNTHETIC_BASE = "https://biblestudytayo.invalid";

export function sameOriginPath(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  try {
    const resolved = new URL(raw, SYNTHETIC_BASE);
    if (resolved.origin !== SYNTHETIC_BASE) return fallback;
    return resolved.pathname + resolved.search + resolved.hash;
  } catch {
    return fallback;
  }
}
