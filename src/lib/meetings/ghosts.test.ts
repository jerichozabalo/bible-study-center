import { describe, expect, it } from "vitest";

import type { CalendarEntry, GroupSchedule } from "./calendar";
import { computeGhosts } from "./ghosts";

/**
 * Issue 5: ghost slots (#49) — the proposed meetings the calendar draws beyond
 * the 8-week materialised horizon, derived not stored.
 */
const LINGGO: GroupSchedule = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "BGroup Linggo",
  weekday: 0, // Sunday
  startTime: "16:00:00",
  durationMinutes: 90,
  currentBookId: "book-1",
};

function entry(over: Partial<CalendarEntry>): CalendarEntry {
  return {
    id: "m",
    groupId: LINGGO.id,
    groupName: LINGGO.name,
    weekday: 0,
    startTime: "16:00:00",
    durationMinutes: 90,
    date: "2026-08-23",
    bookId: null,
    bookNumber: null,
    bookTitle: null,
    sessionId: null,
    sessionNumber: null,
    sessionTitle: null,
    notes: null,
    status: "proposed",
    origin: "generated",
    ledBy: "leader@example.com",
    ...over,
  };
}

describe("computeGhosts", () => {
  it("draws one ghost per schedule occurrence in the window", () => {
    // Window is a single month with no meetings materialised.
    const ghosts = computeGhosts(
      [LINGGO],
      [],
      { from: "2026-12-01", to: "2026-12-31" },
      "2026-11-01",
    );
    expect(ghosts.map((g) => g.date)).toEqual([
      "2026-12-06",
      "2026-12-13",
      "2026-12-20",
      "2026-12-27",
    ]);
    expect(ghosts[0].groupName).toBe("BGroup Linggo");
    expect(ghosts[0].startTime).toBe("16:00:00");
  });

  it("never draws a ghost over a date that already has a meeting", () => {
    const ghosts = computeGhosts(
      [LINGGO],
      [entry({ date: "2026-12-13", status: "cancelled" })],
      { from: "2026-12-01", to: "2026-12-31" },
      "2026-11-01",
    );
    expect(ghosts.map((g) => g.date)).toEqual([
      "2026-12-06",
      "2026-12-20",
      "2026-12-27",
    ]);
  });

  it("clips the start at today — no ghost over a passed date", () => {
    const ghosts = computeGhosts(
      [LINGGO],
      [],
      { from: "2026-12-01", to: "2026-12-31" },
      "2026-12-15",
    );
    expect(ghosts.map((g) => g.date)).toEqual(["2026-12-20", "2026-12-27"]);
  });

  it("returns nothing when there are no live schedules", () => {
    expect(
      computeGhosts([], [], { from: "2026-12-01", to: "2026-12-31" }, "2026-11-01"),
    ).toEqual([]);
  });
});
