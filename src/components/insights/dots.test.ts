import { describe, expect, it } from "vitest";

import { columnsFor } from "./dots";

/**
 * #68, which no artboard renders: the dot row wraps at six.
 *
 * The rule is load-bearing and invisible in a screenshot of any board — every
 * one of them draws a six-session book. Book 7 is eight sessions and Book 8 is
 * twelve, and a single row squeezed those cells to 22px, breaking #30's large
 * targets. Six columns is the fix; a shorter book still fills the width, which
 * is what the board's own stretching row does.
 */
describe("columnsFor", () => {
  it("gives a six-session book a column each", () => {
    expect(columnsFor(6).gridTemplateColumns).toBe("repeat(6, minmax(0, 1fr))");
  });

  it("wraps Book 8's twelve sessions into two rows of six (#68)", () => {
    expect(columnsFor(12).gridTemplateColumns).toBe("repeat(6, minmax(0, 1fr))");
  });

  it("wraps Book 7's eight sessions at six too", () => {
    expect(columnsFor(8).gridTemplateColumns).toBe("repeat(6, minmax(0, 1fr))");
  });

  it("lets a four-session book fill the width, like the board's row", () => {
    expect(columnsFor(4).gridTemplateColumns).toBe("repeat(4, minmax(0, 1fr))");
  });

  it("never asks for no columns at all", () => {
    expect(columnsFor(0).gridTemplateColumns).toBe("repeat(1, minmax(0, 1fr))");
  });
});
