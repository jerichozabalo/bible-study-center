/**
 * Test bootstrap: load `.env.local` so the suite sees the same secrets the app
 * does, then point the database layer at the TEST branch.
 *
 * The redirect is the load-bearing line. `lib/db.ts` reads `DATABASE_URL`, and
 * `.env.local` holds the production Neon branch — a suite that truncated tables
 * would truncate the real ones. Overwriting the variable here means a test file
 * cannot reach production even by importing the ordinary module, which is
 * stronger than asking every test to remember to use a different client.
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const testUrl = process.env.TEST_DATABASE_URL;
if (testUrl) {
  process.env.DATABASE_URL = testUrl;
}

// Deterministic auth secrets so token tests do not depend on what happens to be
// in `.env.local`. Real values are only needed by the running app.
process.env.SESSION_SECRET ??= "test-session-secret-at-least-32-chars-long";
process.env.GOOGLE_CLIENT_ID ??= "test-client-id.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET ??= "test-client-secret";
process.env.ALLOWED_EMAILS ??= "leader@example.com";
