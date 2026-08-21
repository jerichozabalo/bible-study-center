import { describe, expect, it } from "vitest";

import { cookieOptions, originFrom } from "./trip";

/**
 * The redirect_uri is derived twice in one sign-in — once by the server action
 * that sends the leader to Google, and once by the callback route that spends
 * the code — and Google rejects the exchange unless the two strings are
 * byte-identical. The two legs do not see the same headers, which is what makes
 * this worth its own test rather than its own comment.
 */
describe("originFrom", () => {
  it("prefers the Origin header, which the server action's POST carries", () => {
    expect(originFrom({ origin: "https://bst.vercel.app", proto: null, host: "elsewhere" })).toBe(
      "https://bst.vercel.app",
    );
  });

  it("falls back to the forwarded proto and host, which is all the callback gets", () => {
    // A top-level navigation back from accounts.google.com sends no Origin.
    expect(originFrom({ origin: null, proto: "https", host: "bst.vercel.app" })).toBe(
      "https://bst.vercel.app",
    );
  });

  it("agrees with itself across both legs on Vercel", () => {
    const fromAction = originFrom({ origin: "https://bst.vercel.app", proto: null, host: "bst.vercel.app" });
    const fromCallback = originFrom({ origin: null, proto: "https", host: "bst.vercel.app" });

    expect(fromAction).toBe(fromCallback);
  });

  it("agrees with itself across both legs on localhost", () => {
    // The bug this test exists for: with no forwarded proto, defaulting to
    // https gave the callback `https://localhost:3111` while the action had
    // already told Google `http://localhost:3111`, and every local sign-in
    // died on redirect_uri_mismatch.
    const fromAction = originFrom({
      origin: "http://localhost:3111",
      proto: null,
      host: "localhost:3111",
    });
    const fromCallback = originFrom({ origin: null, proto: null, host: "localhost:3111" });

    expect(fromAction).toBe("http://localhost:3111");
    expect(fromCallback).toBe("http://localhost:3111");
  });

  it("treats 127.0.0.1 as local too", () => {
    expect(originFrom({ origin: null, proto: null, host: "127.0.0.1:3000" })).toBe(
      "http://127.0.0.1:3000",
    );
  });

  it("assumes https for any host that is not local", () => {
    expect(originFrom({ origin: null, proto: null, host: "bst.vercel.app" })).toBe(
      "https://bst.vercel.app",
    );
  });

  it("takes only the first entry when a proxy chain forwards several", () => {
    expect(originFrom({ origin: null, proto: "https,http", host: "bst.vercel.app" })).toBe(
      "https://bst.vercel.app",
    );
  });
});

describe("cookieOptions", () => {
  it("marks cookies Secure when the request came over https", () => {
    expect(cookieOptions("https://bst.vercel.app").secure).toBe(true);
  });

  it("does not mark them Secure over plain http", () => {
    // `next start` IS production, so keying Secure off NODE_ENV set the flag on
    // a plain-http origin — and a browser drops a Secure cookie there. Reaching
    // the app at http://192.168.x.x to try it on a phone would silently lose
    // the PKCE verifier and fail the callback with nothing to see (QA pass,
    // 2026-08-21). The scheme that actually carried the request is the only
    // honest answer.
    expect(cookieOptions("http://192.168.1.20:3111").secure).toBe(false);
    expect(cookieOptions("http://localhost:3111").secure).toBe(false);
  });

  it("keeps the settings both legs of the OAuth trip depend on", () => {
    const options = cookieOptions("https://bst.vercel.app");

    expect(options.httpOnly).toBe(true);
    // `lax`, not `strict`: the callback is a top-level navigation from
    // accounts.google.com, and `strict` would withhold the very cookies it needs.
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });
});
