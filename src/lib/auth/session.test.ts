import { describe, expect, it } from "vitest";

import { signSession, verifySession } from "./session";

const SECRET = "a-test-secret-that-is-at-least-32-characters";
const OTHER_SECRET = "a-different-secret-of-sufficient-length!!";

describe("signSession / verifySession", () => {
  it("round-trips the leader's identity", async () => {
    const token = await signSession({ email: "leader@example.com", name: "Jericho" }, SECRET);
    const session = await verifySession(token, SECRET);

    expect(session).toEqual({ email: "leader@example.com", name: "Jericho" });
  });

  it("survives a session with no display name", async () => {
    const token = await signSession({ email: "leader@example.com" }, SECRET);

    expect(await verifySession(token, SECRET)).toEqual({ email: "leader@example.com" });
  });

  it("refuses a token signed with another secret", async () => {
    const token = await signSession({ email: "leader@example.com" }, OTHER_SECRET);

    expect(await verifySession(token, SECRET)).toBeNull();
  });

  it("refuses a tampered token", async () => {
    const token = await signSession({ email: "leader@example.com" }, SECRET);
    const [header, , signature] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ email: "someone@else.com" })).toString(
      "base64url",
    );

    expect(await verifySession(`${header}.${forgedPayload}.${signature}`, SECRET)).toBeNull();
  });

  it("refuses an expired token", async () => {
    const token = await signSession({ email: "leader@example.com" }, SECRET, {
      // Already past by the time it is read.
      expiresInSeconds: -60,
    });

    expect(await verifySession(token, SECRET)).toBeNull();
  });

  it("refuses garbage", async () => {
    expect(await verifySession("", SECRET)).toBeNull();
    expect(await verifySession("not-a-jwt", SECRET)).toBeNull();
  });
});
