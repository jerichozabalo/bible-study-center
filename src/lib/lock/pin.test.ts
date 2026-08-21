import { describe, expect, it } from "vitest";

import { createLockRecord, derivePinHash, isValidPin, setPin, verifyPin } from "./pin";

/**
 * The PIN is never stored. What is stored is a PBKDF2 hash and a salt this
 * install generated for itself, and these tests are the check that no code path
 * quietly writes the four digits instead.
 *
 * Iterations are lowered here — the production count is deliberately slow, and
 * a test suite that pays for it fifteen times is a test suite nobody runs.
 */
const ITERATIONS = 1_000;

describe("isValidPin", () => {
  it("accepts exactly four digits", () => {
    expect(isValidPin("0000")).toBe(true);
    expect(isValidPin("9418")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isValidPin("123")).toBe(false);
    expect(isValidPin("12345")).toBe(false);
    expect(isValidPin("12a4")).toBe(false);
    expect(isValidPin("")).toBe(false);
    expect(isValidPin(" 123")).toBe(false);
  });
});

describe("derivePinHash", () => {
  it("is stable for the same PIN and salt", async () => {
    const a = await derivePinHash("1234", "c2FsdA", ITERATIONS);
    const b = await derivePinHash("1234", "c2FsdA", ITERATIONS);

    expect(a).toBe(b);
  });

  it("differs for a different PIN", async () => {
    const a = await derivePinHash("1234", "c2FsdA", ITERATIONS);
    const b = await derivePinHash("1235", "c2FsdA", ITERATIONS);

    expect(a).not.toBe(b);
  });

  it("differs for a different salt, so two installs share no hashes", async () => {
    const a = await derivePinHash("1234", "c2FsdA", ITERATIONS);
    const b = await derivePinHash("1234", "b3RoZXI", ITERATIONS);

    expect(a).not.toBe(b);
  });

  it("never contains the PIN", async () => {
    const hash = await derivePinHash("1234", "c2FsdA", ITERATIONS);

    expect(hash).not.toContain("1234");
  });
});

describe("createLockRecord", () => {
  it("stores a hash and a fresh salt, not the PIN", async () => {
    const record = await createLockRecord({
      pin: "1234",
      account: "leader@example.com",
      now: 1_000_000,
      iterations: ITERATIONS,
    });

    expect(JSON.stringify(record)).not.toContain("1234");
    expect(record.salt.length).toBeGreaterThan(10);
    expect(record.hash).toBe(await derivePinHash("1234", record.salt, ITERATIONS));
    expect(record.account).toBe("leader@example.com");
    expect(record.lastSeenAt).toBe(1_000_000);
    expect(record.failures).toBe(0);
    expect(record.credentialId).toBeNull();
    expect(record.version).toBe(1);
  });

  it("salts every install separately", async () => {
    const one = await createLockRecord({
      pin: "1234",
      account: "leader@example.com",
      now: 1,
      iterations: ITERATIONS,
    });
    const two = await createLockRecord({
      pin: "1234",
      account: "leader@example.com",
      now: 1,
      iterations: ITERATIONS,
    });

    expect(one.salt).not.toBe(two.salt);
    expect(one.hash).not.toBe(two.hash);
  });

  it("refuses a PIN that is not four digits", async () => {
    await expect(
      createLockRecord({ pin: "12", account: "leader@example.com", now: 1, iterations: ITERATIONS }),
    ).rejects.toThrow(/four digits/i);
  });
});

describe("verifyPin", () => {
  it("accepts the PIN it was created with and rejects any other", async () => {
    const record = await createLockRecord({
      pin: "1234",
      account: "leader@example.com",
      now: 1_000_000,
      iterations: ITERATIONS,
    });

    expect(await verifyPin(record, "1234")).toBe(true);
    expect(await verifyPin(record, "4321")).toBe(false);
    expect(await verifyPin(record, "123")).toBe(false);
  });
});

describe("setPin", () => {
  it("changes the PIN while keeping the biometric credential and the grace interval", async () => {
    // Changing the PIN from Settings is not a new lock: the fingerprint the
    // leader already registered on this phone still unlocks it.
    const record = await createLockRecord({
      pin: "1234",
      account: "leader@example.com",
      now: 1_000_000,
      iterations: ITERATIONS,
    });
    const withBiometric = { ...record, credentialId: "Y3JlZA", failures: 3, lastFailureAt: 9 };

    const changed = await setPin(withBiometric, "5678", ITERATIONS);

    expect(await verifyPin(changed, "5678")).toBe(true);
    expect(await verifyPin(changed, "1234")).toBe(false);
    expect(changed.credentialId).toBe("Y3JlZA");
    expect(changed.salt).not.toBe(record.salt);
    expect(changed.failures).toBe(0);
    expect(changed.lastFailureAt).toBe(0);
  });
});
