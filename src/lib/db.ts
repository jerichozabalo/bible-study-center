/**
 * The only way this app talks to Postgres. Two functions out: `query` and
 * `transaction`. Everything above — curriculum, roster, meetings, attendance,
 * insights — goes through them and never sees a pool, a retry, or a driver.
 *
 * Three facts about the environment are buried here on purpose, because every
 * one of them was learned the hard way and none of them belongs in a caller:
 *
 * 1. Neon's serverless driver reaches for a WebSocket, and Node has no global
 *    one at the version this runs on. Without `neonConfig.webSocketConstructor`
 *    every query fails with something that looks nothing like the real cause.
 * 2. An idle Neon branch autosuspends, and the first query after that throws
 *    `fetch failed` while the compute wakes. `withRetry` sits through it. This
 *    is the normal case, not an outage — see `retry.ts`.
 * 3. The pool is created lazily and cached on `globalThis`, not at module load.
 *    Next's dev server re-evaluates modules on every edit; a pool per
 *    evaluation exhausts Neon's connection limit within an afternoon.
 */
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

import { withRetry } from "./retry";

neonConfig.webSocketConstructor = ws;

type PoolCache = { pool: Pool | null; url: string | null };

const cache: PoolCache = ((globalThis as Record<string, unknown>).__bstPool as PoolCache) ?? {
  pool: null,
  url: null,
};
(globalThis as Record<string, unknown>).__bstPool = cache;

function getPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and fill in the Neon connection string.",
    );
  }
  // The URL is read every call rather than captured once, so the test setup's
  // swap to TEST_DATABASE_URL cannot be defeated by import order.
  if (!cache.pool || cache.url !== url) {
    cache.pool?.end().catch(() => {});
    cache.pool = new Pool({ connectionString: url });
    cache.url = url;
  }
  return cache.pool;
}

export async function query<Row = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<Row[]> {
  return withRetry(async () => {
    const result = await getPool().query(text, params);
    return result.rows as Row[];
  });
}

/**
 * A transaction, retried as a whole unit.
 *
 * Retrying inside the callback would be wrong: once BEGIN has been sent on a
 * connection that then dropped, the statements that follow belong to a
 * transaction that no longer exists. So the retry wraps the checkout, the
 * BEGIN, the body and the COMMIT together — which means the callback can run
 * more than once and must not carry state outside the database.
 */
export async function transaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
  return withRetry(async () => {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const result = await fn({
        query: async <Row = Record<string, unknown>>(text: string, params: unknown[] = []) =>
          (await client.query(text, params)).rows as Row[],
      });
      await client.query("COMMIT");
      return result;
    } catch (thrown) {
      // A rollback on an already-dead connection throws too, and that error
      // would replace the one worth reading.
      await client.query("ROLLBACK").catch(() => {});
      throw thrown;
    } finally {
      client.release();
    }
  });
}

export type TransactionClient = {
  query<Row = Record<string, unknown>>(text: string, params?: unknown[]): Promise<Row[]>;
};
