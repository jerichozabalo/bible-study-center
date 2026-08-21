import { describe, expect, it } from "vitest";

import { dbConfigured } from "../../tests/fixtures";
import { appliedMigrations, migrate, migrationFiles } from "./migrate";

/**
 * The migration runner is the first thing in this repo to write to the
 * database's shape rather than its contents, so what it has to prove is that
 * running it twice is the same as running it once — every later issue adds a
 * file to `migrations/` and runs it against a database that already has most of
 * them.
 */
describe.skipIf(!dbConfigured)("migrate", () => {
  it("finds the migration files in order", async () => {
    const files = await migrationFiles();

    expect(files[0]).toBe("001_curriculum.sql");
    expect(files).toEqual([...files].sort());
  });

  it("applies every migration and records what it applied", async () => {
    await migrate();

    expect(await appliedMigrations()).toEqual(await migrationFiles());
  });

  it("applies nothing on a second run", async () => {
    await migrate();

    expect(await migrate()).toEqual([]);
  });

  it("creates the curriculum and roster tables", async () => {
    await migrate();

    const rows = await tableNames();

    expect(rows).toEqual(expect.arrayContaining(["books", "groups", "people", "programs", "sessions"]));
  });
});

async function tableNames(): Promise<string[]> {
  const { query } = await import("./db");
  const rows = await query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
  );
  return rows.map((row) => row.table_name);
}
