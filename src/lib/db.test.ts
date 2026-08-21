import { afterAll, describe, expect, it } from "vitest";

import { query, transaction } from "./db";

/**
 * The one test in the suite that needs a real database. It runs against the
 * Neon TEST branch (`tests/setup.ts` redirects DATABASE_URL there), and is
 * skipped rather than failed when that branch is not configured — a fresh
 * clone with no `.env.local` should still be able to run the other 42 tests.
 *
 * `npm test` printing "skipped" here means the branch is missing, not that the
 * database works.
 */
// Not merely "set": `.env.local` ships with FILL-ME placeholders, and a
// placeholder is truthy. Anything that is not a Postgres URL means the branch
// has not been created yet.
const configured = /^postgres(ql)?:\/\//.test(process.env.TEST_DATABASE_URL ?? "");

describe.skipIf(!configured)("db", () => {
  afterAll(async () => {
    await query("DROP TABLE IF EXISTS bst_tracer_probe");
  });

  it("reaches Neon and answers a query", async () => {
    const rows = await query<{ answer: number }>("SELECT 1 + 1 AS answer");

    expect(rows).toEqual([{ answer: 2 }]);
  });

  it("passes parameters rather than interpolating them", async () => {
    const rows = await query<{ echoed: string }>("SELECT $1::text AS echoed", ["Bible Study Tayo"]);

    expect(rows[0].echoed).toBe("Bible Study Tayo");
  });

  it("commits a transaction that returns", async () => {
    await query("CREATE TABLE IF NOT EXISTS bst_tracer_probe (note text)");
    await query("DELETE FROM bst_tracer_probe");

    await transaction(async (tx) => {
      await tx.query("INSERT INTO bst_tracer_probe (note) VALUES ($1)", ["kept"]);
    });

    expect(await query("SELECT note FROM bst_tracer_probe")).toEqual([{ note: "kept" }]);
  });

  it("rolls a transaction back when the body throws", async () => {
    await query("CREATE TABLE IF NOT EXISTS bst_tracer_probe (note text)");
    await query("DELETE FROM bst_tracer_probe");

    await expect(
      transaction(async (tx) => {
        await tx.query("INSERT INTO bst_tracer_probe (note) VALUES ($1)", ["discarded"]);
        throw new Error("something went wrong halfway");
      }),
    ).rejects.toThrow("something went wrong halfway");

    expect(await query("SELECT note FROM bst_tracer_probe")).toEqual([]);
  });
});
