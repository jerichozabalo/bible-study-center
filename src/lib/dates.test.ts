import { describe, expect, it } from "vitest";

import { addDays, formatDayMonth, formatLongDate, todayInManila, weekdayOf } from "./dates";

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

describe("todayInManila", () => {
  it("gives the local date as YYYY-MM-DD, the shape a meeting stores (#56)", () => {
    expect(todayInManila(new Date("2026-05-12T09:00:00Z"))).toBe("2026-05-12");
  });

  it("has already turned over while UTC still says yesterday", () => {
    expect(todayInManila(new Date("2026-05-12T20:00:00Z"))).toBe("2026-05-13");
  });
});

describe("addDays", () => {
  it("walks a local date without going through a clock", () => {
    expect(addDays("2026-05-12", 1)).toBe("2026-05-13");
    expect(addDays("2026-05-12", -1)).toBe("2026-05-11");
  });

  it("crosses months and years", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("weekdayOf", () => {
  it("gives Sunday-first day numbers, matching a group's weekday (#46)", () => {
    expect(weekdayOf("2026-08-23")).toBe(0);
    expect(weekdayOf("2026-08-26")).toBe(3);
  });
});

describe("formatLongDate", () => {
  it("names the day and the date the way the boards write it", () => {
    expect(formatLongDate("2026-08-19")).toBe("Wednesday, 19 August");
  });
});
