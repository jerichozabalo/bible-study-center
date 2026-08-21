import { describe, expect, it } from "vitest";

import { formValuesFrom } from "./form";

describe("formValuesFrom", () => {
  /**
   * What the form re-renders with after a refusal. Its own function because a
   * refusal used to hand the form nothing, so the four fields the leader had
   * already chosen fell back to their defaults and had to be picked again —
   * Sundays, 7:00 PM, 1 hr 30 min, no book, every time (QA pass, 2026-08-21).
   */
  function form(entries: Record<string, string>): FormData {
    const data = new FormData();
    for (const [key, value] of Object.entries(entries)) data.append(key, value);
    return data;
  }

  it("hands back exactly what was submitted", () => {
    expect(
      formValuesFrom(
        form({
          name: "BGroup Biyernes",
          weekday: "5",
          startTime: "06:30",
          durationMinutes: "180",
          currentBookId: "book-7",
        }),
      ),
    ).toEqual({
      name: "BGroup Biyernes",
      weekday: 5,
      startTime: "06:30",
      durationMinutes: 180,
      currentBookId: "book-7",
    });
  });

  it("keeps the choices even when the name is the thing that failed", () => {
    const values = formValuesFrom(
      form({ name: "", weekday: "3", startTime: "19:30", durationMinutes: "60", currentBookId: "" }),
    );

    expect(values.weekday).toBe(3);
    expect(values.startTime).toBe("19:30");
    expect(values.durationMinutes).toBe(60);
    expect(values.name).toBe("");
    // "Not chosen yet" posts an empty string and must come back as no book,
    // not as a book whose id is "".
    expect(values.currentBookId).toBeNull();
  });

  it("falls back to the form's own defaults when a field never arrived", () => {
    // A re-render must not put NaN into a `<select>` — `weekday` and
    // `durationMinutes` are numbers, and `Number("")` is 0, which is Sunday.
    const values = formValuesFrom(form({ name: "Half a form" }));

    expect(Number.isNaN(values.weekday)).toBe(false);
    expect(Number.isNaN(values.durationMinutes)).toBe(false);
    expect(values.startTime).not.toBe("");
  });
});

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
