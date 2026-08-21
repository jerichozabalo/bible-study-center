import { describe, expect, it } from "vitest";

import { formatDayMonth } from "./dates";

/**
 * Dates are read in Manila, wherever the server happens to be standing.
 * Vercel's functions run in UTC, so a timestamp taken at 6am in Bulacan is
 * yesterday's date to `getDate()` — the group would say it was archived on the
 * wrong day, every morning.
 */
describe("formatDayMonth", () => {
  it("prints the day and the month", () => {
    expect(formatDayMonth(new Date("2026-05-12T09:00:00Z"))).toBe("12 May");
  });

  it("reads the clock in Asia/Manila (#56)", () => {
    // 4am on the 13th in Bulacan, still the 12th in UTC.
    expect(formatDayMonth(new Date("2026-05-12T20:00:00Z"))).toBe("13 May");
  });
});
