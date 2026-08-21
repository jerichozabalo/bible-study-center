import { describe, expect, it } from "vitest";

import { formatDuration, formatMembers, formatSchedule, formatTime, weekdayPlural } from "./schedule";

/**
 * The one line a group card lives or dies by: "Sundays 4:00 PM · 1 hr 30 min".
 * Pure formatting, so it is tested without a database — every screen that shows
 * a schedule calls these instead of writing its own.
 */
describe("schedule formatting", () => {
  it("names the weekdays Sunday-first, the way the calendar counts them (#46)", () => {
    expect(weekdayPlural(0)).toBe("Sundays");
    expect(weekdayPlural(2)).toBe("Tuesdays");
    expect(weekdayPlural(6)).toBe("Saturdays");
  });

  it("reads a Postgres time back as a wall clock", () => {
    expect(formatTime("16:00:00")).toBe("4:00 PM");
    expect(formatTime("07:30")).toBe("7:30 AM");
    expect(formatTime("00:15:00")).toBe("12:15 AM");
    expect(formatTime("12:00:00")).toBe("12:00 PM");
  });

  it("says a duration the way a person would", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(60)).toBe("1 hr");
    expect(formatDuration(90)).toBe("1 hr 30 min");
    expect(formatDuration(120)).toBe("2 hrs");
  });

  it("joins day, time and duration into the card's line", () => {
    expect(formatSchedule({ weekday: 0, startTime: "16:00:00", durationMinutes: 90 })).toBe(
      "Sundays 4:00 PM · 1 hr 30 min",
    );
  });

  it("counts members without an empty group reading as a bug", () => {
    expect(formatMembers(6)).toBe("6 members");
    expect(formatMembers(1)).toBe("1 member");
    expect(formatMembers(0)).toBe("No members yet");
  });
});
