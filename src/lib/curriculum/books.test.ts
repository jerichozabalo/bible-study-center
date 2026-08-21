import { describe, expect, it } from "vitest";

import { bookLabel } from "./books";

/**
 * How a book is named on screen. The number and the title are separate columns
 * (a custom book has no number), and every screen that names a book renders
 * them through here so the em dash and the "Book n" prefix cannot drift.
 */
describe("bookLabel", () => {
  it("prefixes a published book with its number", () => {
    expect(bookLabel({ number: 1, title: "One By One" })).toBe("Book 1 — One By One");
  });

  it("leaves a custom book as its own title", () => {
    expect(bookLabel({ number: null, title: "Kingdom Parables" })).toBe("Kingdom Parables");
  });

  it("quotes CCF's printed title as published, DGroup and all (#66)", () => {
    expect(bookLabel({ number: 5, title: "Starting Point for Small Groups / DGroup 101" })).toBe(
      "Book 5 — Starting Point for Small Groups / DGroup 101",
    );
  });
});
