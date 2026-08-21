/**
 * Shared scaffolding for the tests that need the real (TEST) database.
 *
 * `tests/setup.ts` has already pointed `DATABASE_URL` at the test branch by the
 * time any of this runs, so everything here goes through `lib/db` like the app
 * does — there is no second client anywhere in this repo.
 */
import { query } from "@/lib/db";
import { migrate } from "@/lib/migrate";
import { createPerson } from "@/lib/roster/people";

let schema: Promise<unknown> | null = null;

/**
 * Bring the test branch's schema up to date, once per test file.
 *
 * Every database test needs the tables to exist, and nothing guarantees which
 * file vitest reaches first — so each one asks rather than assuming an earlier
 * file already ran the migrations.
 */
export function ensureSchema(): Promise<unknown> {
  schema ??= migrate();
  return schema;
}

/**
 * Whether a test branch is actually configured. Not merely "set": `.env.example`
 * ships FILL-ME placeholders and a placeholder is truthy, so anything that is
 * not a Postgres URL means the branch has not been created yet. Database tests
 * skip on that rather than fail, so a fresh clone can still run the rest.
 */
export const dbConfigured = /^postgres(ql)?:\/\//.test(process.env.TEST_DATABASE_URL ?? "");

/** The address every fixture stamps as `owner_id` (#32 — always one leader in v1). */
export const TEST_OWNER = "leader@example.com";

/**
 * Empty the roster tables between tests. Curriculum rows are left alone: they
 * are seeded reference data, and re-seeding them for every test would spend a
 * network round trip per assertion for rows that never change.
 */
export async function resetRoster(): Promise<void> {
  // The two roster tables cascade from `people`, but they are named here so a
  // reader of this file can see everything a reset empties.
  await query("DELETE FROM person_corrections");
  await query("DELETE FROM group_memberships");
  await query("DELETE FROM people");
  await query("DELETE FROM groups");
}

/**
 * A person on the roster — through the module the app itself uses, so a fixture
 * cannot describe a person the app could not have created (#67's name-only
 * walk-in included).
 */
export async function addPerson(name: string, homeGroupId: string | null): Promise<string> {
  return createPerson(TEST_OWNER, { name, homeGroupId });
}

/** The id of a seeded GLC book by its published number. */
export async function bookIdByNumber(number: number): Promise<string> {
  const rows = await query<{ id: string }>("SELECT id FROM books WHERE number = $1", [number]);
  return rows[0].id;
}
