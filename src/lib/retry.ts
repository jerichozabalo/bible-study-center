/**
 * Retry with backoff, for the one failure this app expects to see constantly.
 *
 * Neon autosuspends an idle branch. The first query after that throws
 * `fetch failed` — a TypeError from undici, not a Postgres error — while the
 * compute wakes, and on Jericho's connection a transient DNS or socket failure
 * looks the same. Treating either as an outage would mean the app reports
 * itself broken several times a day when nothing is wrong.
 *
 * What is deliberately NOT retried: anything that failed because the query was
 * wrong. A syntax error, a missing relation, a constraint violation will fail
 * identically three times and only reach the log three delays later. The list
 * below is a whitelist of "the connection, not the statement" for that reason —
 * an unrecognised error is assumed to be the caller's fault and rethrown at
 * once.
 */
const TRANSIENT = [
  "fetch failed",
  "econnreset",
  "econnrefused",
  "etimedout",
  "eai_again",
  "enotfound",
  "socket hang up",
  "connection terminated",
  "terminating connection",
  "server closed the connection",
];

export function isTransient(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const haystack = message.toLowerCase();
  return TRANSIENT.some((needle) => haystack.includes(needle));
}

export type RetryOptions = {
  attempts?: number;
  baseDelayMs?: number;
  /** Injectable so tests do not spend the backoff in real time. */
  sleep?: (ms: number) => Promise<void>;
};

export async function withRetry<T>(
  attempt: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 250;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      return await attempt();
    } catch (thrown) {
      if (!isTransient(thrown)) throw thrown;
      lastError = thrown;
      if (i < attempts - 1) await sleep(baseDelayMs * 2 ** i);
    }
  }

  throw lastError;
}
