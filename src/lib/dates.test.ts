import { describe, expect, it } from "vitest";

import { ageOn, formatDayMonth, formatLongDate, isCalendarDate, manilaToday } from "./dates";

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

/**
 * The roster's date fields — birthday, baptized on, joined on — are calendar
 * days, not instants. They are read out of Postgres as `YYYY-MM-DD` text and
 * stay that way, so nothing here can shift one across midnight.
 */
describe("formatLongDate", () => {
  it("prints a calendar day the way the Person board writes it", () => {
    expect(formatLongDate("1988-03-14")).toBe("14 March 1988");
  });

  it("does not move the day, whatever the server's own zone is", () => {
    expect(formatLongDate("2026-01-01")).toBe("1 January 2026");
    expect(formatLongDate("2026-12-31")).toBe("31 December 2026");
  });

  it("hands back anything that is not a calendar day untouched", () => {
    expect(formatLongDate("")).toBe("");
  });
});

describe("isCalendarDate", () => {
  it("accepts what a date input posts", () => {
    expect(isCalendarDate("2026-08-21")).toBe(true);
  });

  it("refuses a day that does not exist, and anything typed by hand", () => {
    expect(isCalendarDate("2026-02-30")).toBe(false);
    expect(isCalendarDate("21/08/2026")).toBe(false);
    expect(isCalendarDate("2026-8-1")).toBe(false);
    expect(isCalendarDate("yesterday")).toBe(false);
  });
});

describe("manilaToday", () => {
  it("is the day it is in Bulacan, not in UTC", () => {
    // 8am on the 22nd in Manila; still the 21st everywhere UTC.
    expect(manilaToday(new Date("2026-08-21T23:59:00Z"))).toBe("2026-08-22");
    expect(manilaToday(new Date("2026-08-21T15:00:00Z"))).toBe("2026-08-21");
  });
});

/** Age is derived from the birthday, never stored (#9b). */
describe("ageOn", () => {
  it("counts the birthdays that have already come round", () => {
    expect(ageOn("1988-03-14", "2026-08-21")).toBe(38);
  });

  it("does not count a birthday still ahead this year", () => {
    expect(ageOn("1988-11-02", "2026-08-21")).toBe(37);
  });

  it("counts the birthday itself on the day", () => {
    expect(ageOn("1988-08-21", "2026-08-21")).toBe(38);
  });

  it("has no answer for a date that is not a calendar day", () => {
    expect(ageOn("", "2026-08-21")).toBeNull();
  });
});
