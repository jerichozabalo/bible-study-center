/**
 * Print a signed session JWT for local QA — no Google round trip.
 *
 * Usage:  SESSION_SECRET=<same secret the server runs with> npx tsx scripts/qa-mint-session.mts
 * Then set it as the `bst_session` cookie in the browser before navigating.
 */
const secret = process.env.SESSION_SECRET;
if (!secret || secret.length < 32) {
  console.error("SESSION_SECRET must be set and >= 32 chars");
  process.exit(1);
}

const { signSession } = await import("../src/lib/auth/session");
const token = await signSession({ email: "leader@example.com", name: "QA Leader" }, secret);
process.stdout.write(token);
