import { describe, expect, it } from "vitest";

import { parseGroupForm } from "./form";

/**
 * The gap between an HTML form and the module's input type: everything arrives
 * as a string, and "no book chosen yet" arrives as an empty one.
 *
 * Nothing here decides whether the values are acceptable — `groups.ts` does
 * that, in one place, for the form and for any other caller.
 */
describe("parseGroupForm", () => {
  function formOf(fields: Record<string, string>): FormData {
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.append(key, value);
    return data;
  }

  it("reads the schedule the form posts", () => {
    const input = parseGroupForm(
      formOf({
        name: "BGroup Linggo",
        weekday: "0",
        startTime: "16:00",
        durationMinutes: "90",
        currentBookId: "5c0f0b3e-0000-4000-8000-000000000001",
      }),
    );

    expect(input).toEqual({
      name: "BGroup Linggo",
      weekday: 0,
      startTime: "16:00",
      durationMinutes: 90,
      currentBookId: "5c0f0b3e-0000-4000-8000-000000000001",
    });
  });

  it("reads an unchosen book as no book", () => {
    const input = parseGroupForm(formOf({ name: "X", weekday: "2", startTime: "19:00", durationMinutes: "60", currentBookId: "" }));

    expect(input.currentBookId).toBeNull();
  });

  it("does not turn a missing number into a valid one", () => {
    // Number("") is 0, and 0 is Sunday — a dropped field must not quietly
    // schedule the group for Sunday. NaN fails validation instead.
    const input = parseGroupForm(formOf({ name: "X", weekday: "", startTime: "19:00", durationMinutes: "" }));

    expect(input.weekday).toBeNaN();
    expect(input.durationMinutes).toBeNaN();
  });
});
