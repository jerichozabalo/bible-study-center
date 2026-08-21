/**
 * The migration runner. `npm run db:migrate` is one line over this.
 *
 * The shape of the whole thing: numbered `.sql` files in `migrations/`, applied
 * in filename order, each one recorded in `schema_migrations` so it is applied
 * exactly once. Every later issue adds a file and runs this against a database
 * that already has the earlier ones.
 *
 * Three rules the files themselves have to keep:
 *
 * 1. **Numbered and never renamed.** The filename IS the record; renaming an
 *    applied file makes it pending again.
 * 2. **Idempotent anyway** — `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT
 *    EXISTS`. `lib/db`'s retry re-runs a whole transaction when Neon's
 *    autosuspend drops the first attempt, so a file can genuinely run twice on
 *    one pass and must survive it.
 * 3. **Additive.** History is never rewritten (#24) and neither is the schema
 *    that holds it: a correction is a new file, not an edit to an old one.
 *
 * Each file runs inside a transaction together with its bookkeeping row, so a
 * half-applied file cannot be recorded as done — Postgres rolls DDL back like
 * anything else.
 */
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { query, transaction } from "./db";

/** `migrations/`, resolved from this file rather than from the process's cwd. */
const MIGRATIONS_DIR = fileURLToPath(new URL("../../migrations/", import.meta.url));

/** Every migration file, in the order they must be applied. */
export async function migrationFiles(): Promise<string[]> {
  const entries = await readdir(MIGRATIONS_DIR);
  return entries.filter((name) => name.endsWith(".sql")).sort();
}

/** What the database says it has already run. */
export async function appliedMigrations(): Promise<string[]> {
  await ensureLedger();
  const rows = await query<{ name: string }>(
    "SELECT name FROM schema_migrations ORDER BY name ASC",
  );
  return rows.map((row) => row.name);
}

/**
 * Apply every migration the database has not seen yet.
 *
 * Returns the names applied on this run — empty when there was nothing to do,
 * which is the normal answer and what makes this safe to run on every deploy.
 */
export async function migrate(): Promise<string[]> {
  await ensureLedger();

  const applied = new Set(await appliedMigrations());
  const pending = (await migrationFiles()).filter((name) => !applied.has(name));

  for (const name of pending) {
    const sql = await readFile(`${MIGRATIONS_DIR}${name}`, "utf8");

    await transaction(async (tx) => {
      // No parameters, deliberately: with none, the driver sends this as a
      // simple query, which is the only way one call can carry the several
      // statements a migration file is made of.
      await tx.query(sql);
      await tx.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
    });
  }

  return pending;
}

async function ensureLedger(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}
