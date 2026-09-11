import { describe, expect, it } from "vitest";

import { baptizedLabel, displayName, initialsOf } from "./display";

/**
 * bst-v1.1 issue 1 — one rule, one helper: when a nickname is set it is the
 * name shown everywhere, and the full name stays the stored record.
 */
describe("displayName", () => {
  it("shows the nickname when one is set", () => {
    expect(displayName({ name: "Nena Villamor", nickname: "Nena" })).toBe("Nena");
  });

  it("falls back to the full name when there is none", () => {
    expect(displayName({ name: "Nena Villamor", nickname: null })).toBe("Nena Villamor");
  });

  it("treats a blank nickname as none at all", () => {
    // Storage turns an empty one into NULL (`people.ts`); a queued payload or a
    // half-typed form must read the same way rather than showing nothing.
    expect(displayName({ name: "Nena Villamor", nickname: "   " })).toBe("Nena Villamor");
  });
});

/** The avatar square on the People and Person boards. */
describe("initialsOf", () => {
  it("takes the first and last name", () => {
    expect(initialsOf("Nena Villamor")).toBe("NV");
    expect(initialsOf("maria santos")).toBe("MS");
  });

  it("skips an honorific", () => {
    // The People board draws "Ptr. Ariel Mendoza" as AM, not PM.
    expect(initialsOf("Ptr. Ariel Mendoza")).toBe("AM");
  });

  it("copes with the one-word name a walk-in arrives as (#67)", () => {
    expect(initialsOf("Nico")).toBe("N");
    expect(initialsOf("")).toBe("?");
  });
});

/**
 * #66 — "baptized", that spelling. The un-baptized state describes a situation
 * ("Not yet") rather than grading anyone.
 */
describe("baptizedLabel", () => {
  it("names the date when there is one", () => {
    expect(baptizedLabel(true, "2024-05-03")).toBe("Baptized 3 May 2024");
  });

  it("says so without a date", () => {
    expect(baptizedLabel(true, null)).toBe("Baptized");
  });

  it("puts it in the future rather than marking anyone down", () => {
    expect(baptizedLabel(false, null)).toBe("Not yet baptized");
  });
});
