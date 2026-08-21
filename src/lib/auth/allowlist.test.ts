import { describe, expect, it } from "vitest";

import { isAllowed, parseAllowlist } from "./allowlist";

describe("parseAllowlist", () => {
  it("splits a comma-separated list and trims it", () => {
    expect(parseAllowlist(" a@x.com , b@y.com ")).toEqual(["a@x.com", "b@y.com"]);
  });

  it("lowercases, so a capitalised env value still matches", () => {
    expect(parseAllowlist("Leader@Example.COM")).toEqual(["leader@example.com"]);
  });

  it("drops empty entries left by a trailing comma", () => {
    expect(parseAllowlist("a@x.com,,")).toEqual(["a@x.com"]);
  });

  it("reads an unset or blank value as an empty list", () => {
    expect(parseAllowlist(undefined)).toEqual([]);
    expect(parseAllowlist("   ")).toEqual([]);
  });
});

describe("isAllowed", () => {
  const list = ["leader@example.com"];

  it("admits the listed account", () => {
    expect(isAllowed("leader@example.com", list)).toBe(true);
  });

  it("admits it regardless of how Google cased the address", () => {
    expect(isAllowed("Leader@Example.com", list)).toBe(true);
  });

  it("rejects any other account", () => {
    expect(isAllowed("stranger@example.com", list)).toBe(false);
  });

  it("rejects everyone when the allowlist is empty", () => {
    // v1 is single-user (#1). An empty list is a misconfigured deployment, and
    // the safe reading of one is "nobody", never "anybody".
    expect(isAllowed("leader@example.com", [])).toBe(false);
  });

  it("rejects a missing address", () => {
    expect(isAllowed(undefined, list)).toBe(false);
    expect(isAllowed("", list)).toBe(false);
  });
});
