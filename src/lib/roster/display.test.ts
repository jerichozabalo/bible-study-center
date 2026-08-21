import { describe, expect, it } from "vitest";

import { baptizedLabel, initialsOf } from "./display";

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
