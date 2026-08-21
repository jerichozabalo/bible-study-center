import { describe, expect, it } from "vitest";

import { sameOriginPath } from "./safe-path";

describe("sameOriginPath", () => {
  it("keeps an ordinary on-site path, with its query and fragment", () => {
    expect(sameOriginPath("/calendar?week=3#today", "/")).toBe("/calendar?week=3#today");
  });

  it("falls back when there is nothing to narrow", () => {
    expect(sameOriginPath(null, "/")).toBe("/");
    expect(sameOriginPath(undefined, "/")).toBe("/");
    expect(sameOriginPath("", "/home")).toBe("/home");
  });

  it("refuses an absolute URL to another origin", () => {
    expect(sameOriginPath("https://evil.tld/steal", "/")).toBe("/");
  });

  it("refuses a protocol-relative URL", () => {
    expect(sameOriginPath("//evil.tld/steal", "/")).toBe("/");
  });

  it("refuses a backslash-prefixed path, which the URL parser resolves off-site", () => {
    // The string guard this replaces (`startsWith("/") && !startsWith("//")`)
    // passes this one, and `new URL` then resolves it to https://evil.tld/.
    expect(sameOriginPath("/\\evil.tld", "/")).toBe("/");
  });

  it("refuses a path smuggling a tab or newline past a string guard", () => {
    expect(sameOriginPath("/\t/evil.tld", "/")).toBe("/");
    expect(sameOriginPath("/\n/evil.tld", "/")).toBe("/");
  });

  it("refuses a javascript: or data: scheme", () => {
    expect(sameOriginPath("javascript:alert(1)", "/")).toBe("/");
    expect(sameOriginPath("data:text/html,<script>", "/")).toBe("/");
  });
});
