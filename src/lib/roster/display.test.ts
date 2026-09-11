import { describe, expect, it } from "vitest";

import { baptizedLabel, initialsOf, personLabel, salvationLabel } from "./display";

/**
 * bst-v1.1 issue 1, amended 2026-09-11 (Jericho, on seeing it live): the FULL
 * name leads everywhere; the nickname is the annotation after it. The record
 * first, the name-you-call-them second.
 */
describe("personLabel", () => {
  it("leads with the full name and appends the nickname", () => {
    expect(personLabel({ name: "Nena Villamor", nickname: "Nena" })).toBe("Nena Villamor (Nena)");
  });

  it("is the full name alone when there is no nickname", () => {
    expect(personLabel({ name: "Nena Villamor", nickname: null })).toBe("Nena Villamor");
  });

  it("treats a blank nickname as none at all", () => {
    // Storage turns an empty one into NULL (`people.ts`); a queued payload or a
    // half-typed form must read the same way rather than showing nothing.
    expect(personLabel({ name: "Nena Villamor", nickname: "   " })).toBe("Nena Villamor");
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

/**
 * bst-v1.1 issue 2 — the salvation prayer chip. Same shape and same tone as
 * the baptism one: the un-prayed state says where someone is on the road
 * ("Not yet"), never a mark against them.
 */
describe("salvationLabel", () => {
  it("names the date when there is one", () => {
    expect(salvationLabel(true, "2024-04-14")).toBe(
      "Prayed the salvation prayer · 14 April 2024",
    );
  });

  it("says so without a date", () => {
    expect(salvationLabel(true, null)).toBe("Prayed the salvation prayer");
  });

  it("puts it in the future rather than marking anyone down", () => {
    expect(salvationLabel(false, null)).toBe("Not yet prayed the salvation prayer");
  });
});
