import { describe, expect, it } from "vitest";

import { fromBase64Url, randomBytes, toBase64Url } from "./bytes";

describe("base64url", () => {
  it("round-trips arbitrary bytes", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);

    expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
  });

  it("uses the url alphabet and no padding", () => {
    // Credential ids and salts end up in `localStorage` and in WebAuthn
    // options; `+`, `/` and `=` have no business in either.
    const encoded = toBase64Url(new Uint8Array([251, 255, 190, 255]));

    expect(encoded).not.toMatch(/[+/=]/);
  });

  it("encodes an empty array as an empty string", () => {
    expect(toBase64Url(new Uint8Array())).toBe("");
    expect(fromBase64Url("")).toEqual(new Uint8Array());
  });
});

describe("randomBytes", () => {
  it("returns the requested length", () => {
    expect(randomBytes(16)).toHaveLength(16);
  });

  it("does not repeat itself", () => {
    expect(toBase64Url(randomBytes(16))).not.toBe(toBase64Url(randomBytes(16)));
  });
});
