import { describe, expect, it } from "vitest";

import {
  LOCK_GRACE_MS,
  type LockRecord,
  afterUnlock,
  afterWrongPin,
  blockedForMs,
  retryDelayMs,
  statusFor,
  touch,
} from "./state";

/**
 * The lock is device-local and has no server half, so this state machine is the
 * whole of its behaviour: what "locked" means, when the grace interval saves
 * the leader a PIN entry, and what a wrong PIN costs. It takes `now` and a
 * stored record as arguments precisely so it can be tested without a browser.
 */

const RECORD: LockRecord = {
  version: 1,
  account: "leader@example.com",
  salt: "c2FsdA",
  hash: "aGFzaA",
  iterations: 250_000,
  credentialId: null,
  lastSeenAt: 1_000_000,
  failures: 0,
  lastFailureAt: 0,
};

describe("statusFor", () => {
  it("is off when this device has no PIN", () => {
    expect(statusFor(null, "leader@example.com", 1_000_000)).toEqual({ kind: "off" });
  });

  it("is off when the stored lock belongs to a different account", () => {
    // Signing out and back in as someone else must not leave the previous
    // account's PIN standing in front of this one (#19 — the account is the
    // identity, not the PIN).
    expect(statusFor(RECORD, "someone.else@example.com", 1_000_000)).toEqual({ kind: "off" });
  });

  it("stays unlocked while the app is returned to inside the grace interval", () => {
    const now = RECORD.lastSeenAt + LOCK_GRACE_MS - 1;
    expect(statusFor(RECORD, RECORD.account, now)).toEqual({ kind: "unlocked" });
  });

  it("still counts the last millisecond of the grace interval as unlocked", () => {
    const now = RECORD.lastSeenAt + LOCK_GRACE_MS;
    expect(statusFor(RECORD, RECORD.account, now)).toEqual({ kind: "unlocked" });
  });

  it("locks once the grace interval has passed", () => {
    const now = RECORD.lastSeenAt + LOCK_GRACE_MS + 1;
    expect(statusFor(RECORD, RECORD.account, now)).toEqual({
      kind: "locked",
      failures: 0,
      blockedForMs: 0,
    });
  });

  it("locks when the record claims to have been seen in the future", () => {
    // A clock that moved backwards must not hand out an unlimited grace
    // interval — the one direction this can be wrong in should ask for the PIN.
    expect(statusFor(RECORD, RECORD.account, RECORD.lastSeenAt - 60_000)).toEqual({
      kind: "locked",
      failures: 0,
      blockedForMs: 0,
    });
  });

  it("reports the remaining backoff on a locked status", () => {
    const record = { ...RECORD, failures: 4, lastFailureAt: 2_000_000 };
    const status = statusFor(record, record.account, 2_001_000);

    expect(status).toEqual({ kind: "locked", failures: 4, blockedForMs: 4_000 });
  });
});

describe("retryDelayMs", () => {
  it("costs nothing for the first three wrong PINs", () => {
    // Mistyping a four-digit PIN on a phone is ordinary. The delay is for
    // someone guessing, not for the leader fumbling mid-meeting.
    expect(retryDelayMs(1)).toBe(0);
    expect(retryDelayMs(2)).toBe(0);
    expect(retryDelayMs(3)).toBe(0);
  });

  it("escalates after that", () => {
    expect(retryDelayMs(4)).toBe(5_000);
    expect(retryDelayMs(5)).toBe(15_000);
    expect(retryDelayMs(6)).toBe(30_000);
  });

  it("caps at a minute and never locks the leader out for good", () => {
    expect(retryDelayMs(7)).toBe(60_000);
    expect(retryDelayMs(50)).toBe(60_000);
    expect(Number.isFinite(retryDelayMs(50))).toBe(true);
  });
});

describe("blockedForMs", () => {
  it("is zero while there is nothing to wait for", () => {
    expect(blockedForMs(RECORD, 1_000_000)).toBe(0);
  });

  it("counts down and reaches zero", () => {
    const record = { ...RECORD, failures: 5, lastFailureAt: 2_000_000 };

    expect(blockedForMs(record, 2_000_000)).toBe(15_000);
    expect(blockedForMs(record, 2_010_000)).toBe(5_000);
    expect(blockedForMs(record, 2_015_000)).toBe(0);
    expect(blockedForMs(record, 9_999_999)).toBe(0);
  });
});

describe("afterWrongPin", () => {
  it("counts the failure and stamps when it happened", () => {
    const next = afterWrongPin(RECORD, 2_000_000);

    expect(next.failures).toBe(1);
    expect(next.lastFailureAt).toBe(2_000_000);
  });

  it("does not extend the grace interval", () => {
    // A wrong PIN is not activity worth trusting.
    expect(afterWrongPin(RECORD, 2_000_000).lastSeenAt).toBe(RECORD.lastSeenAt);
  });
});

describe("afterUnlock", () => {
  it("forgets the failures and starts a fresh grace interval", () => {
    const record = { ...RECORD, failures: 6, lastFailureAt: 2_000_000 };
    const next = afterUnlock(record, 2_500_000);

    expect(next.failures).toBe(0);
    expect(next.lastFailureAt).toBe(0);
    expect(next.lastSeenAt).toBe(2_500_000);
    expect(statusFor(next, next.account, 2_500_000)).toEqual({ kind: "unlocked" });
  });
});

describe("touch", () => {
  it("moves the grace interval forward without touching the failures", () => {
    const record = { ...RECORD, failures: 2, lastFailureAt: 2_000_000 };
    const next = touch(record, 2_400_000);

    expect(next.lastSeenAt).toBe(2_400_000);
    expect(next.failures).toBe(2);
    expect(next.lastFailureAt).toBe(2_000_000);
  });
});
