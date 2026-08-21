import { describe, expect, it, vi } from "vitest";

import { withRetry } from "./retry";

describe("withRetry", () => {
  it("returns the first answer when there is nothing to retry", async () => {
    const attempt = vi.fn(async () => "ok");

    expect(await withRetry(attempt, { sleep: async () => {} })).toBe("ok");
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("rides out a cold Neon branch and returns the answer that follows", async () => {
    // Autosuspend: the first connection to a sleeping branch throws
    // `fetch failed` while it wakes. This is the normal case, not an outage.
    const attempt = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce("awake");

    expect(await withRetry(attempt, { sleep: async () => {} })).toBe("awake");
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it("gives up after the last attempt and rethrows what actually failed", async () => {
    const attempt = vi.fn(async () => {
      throw new Error("fetch failed");
    });

    await expect(withRetry(attempt, { attempts: 3, sleep: async () => {} })).rejects.toThrow(
      "fetch failed",
    );
    expect(attempt).toHaveBeenCalledTimes(3);
  });

  it("backs off further with each attempt", async () => {
    const waits: number[] = [];
    const attempt = vi.fn(async () => {
      throw new Error("fetch failed");
    });

    await expect(
      withRetry(attempt, {
        attempts: 4,
        baseDelayMs: 100,
        sleep: async (ms) => {
          waits.push(ms);
        },
      }),
    ).rejects.toThrow();

    expect(waits).toEqual([100, 200, 400]);
  });

  it("does not retry a query that was wrong rather than unreachable", async () => {
    // A syntax error or a constraint violation will fail identically on every
    // attempt. Retrying it only makes the failure take three times as long to
    // reach the log.
    const attempt = vi.fn(async () => {
      throw new Error('relation "meetings" does not exist');
    });

    await expect(withRetry(attempt, { sleep: async () => {} })).rejects.toThrow(/does not exist/);
    expect(attempt).toHaveBeenCalledTimes(1);
  });
});
