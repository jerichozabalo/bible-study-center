import { beforeEach, describe, expect, it, vi } from "vitest";

import { createLockController } from "./controller";
import { LOCK_GRACE_MS, type LockRecord } from "./state";
import type { LockStore } from "./storage";
import type { WebAuthnApi } from "./webauthn";

/**
 * The orchestration the lock screen and the Settings rows both drive: what a
 * wrong PIN does, what going away and coming back does, and what happens when
 * the device's stored lock belongs to an account that is no longer signed in.
 *
 * Storage, the clock and WebAuthn are all injected, so this runs in Node.
 */

const ACCOUNT = "leader@example.com";
/** The production count is deliberately slow; the suite would pay for it here. */
const ITERATIONS = 1_000;

function memoryStore(): LockStore & { record: LockRecord | null } {
  const store = {
    record: null as LockRecord | null,
    read: () => store.record,
    write: (record: LockRecord) => void (store.record = record),
    clear: () => void (store.record = null),
  };
  return store;
}

function fakeWebAuthn(credentialId = "Y3JlZA"): WebAuthnApi {
  const rawId = new TextEncoder().encode("cred");
  const credential = {
    id: credentialId,
    type: "public-key",
    rawId: rawId.buffer.slice(rawId.byteOffset, rawId.byteOffset + rawId.byteLength),
  } as unknown as Credential;

  return { create: vi.fn(async () => credential), get: vi.fn(async () => credential) };
}

let clock = 1_000_000;
const now = () => clock;

function controllerWith(store: LockStore, webauthn: WebAuthnApi | null = fakeWebAuthn()) {
  return createLockController({ account: ACCOUNT, store, now, webauthn, iterations: ITERATIONS });
}

beforeEach(() => {
  clock = 1_000_000;
});

describe("a device with no PIN", () => {
  it("is off, and nothing is in front of the app", () => {
    const lock = controllerWith(memoryStore());
    lock.refresh();

    expect(lock.getState()).toMatchObject({ enabled: false, locked: false, ready: true });
  });
});

describe("setting the PIN", () => {
  it("stores a lock for this account and leaves the app open", async () => {
    const store = memoryStore();
    const lock = controllerWith(store);

    await lock.enableLock("1234");

    expect(store.record?.account).toBe(ACCOUNT);
    expect(lock.getState()).toMatchObject({ enabled: true, locked: false });
  });

  it("tells subscribers", async () => {
    const lock = controllerWith(memoryStore());
    const listener = vi.fn();
    lock.subscribe(listener);

    await lock.enableLock("1234");

    expect(listener).toHaveBeenCalled();
  });

  it("refuses a PIN that is not four digits", async () => {
    const lock = controllerWith(memoryStore());

    await expect(lock.enableLock("12")).rejects.toThrow(/four digits/i);
    expect(lock.getState().enabled).toBe(false);
  });
});

describe("going away and coming back", () => {
  it("stays open when the leader is back inside the grace interval", async () => {
    const lock = controllerWith(memoryStore());
    await lock.enableLock("1234");

    lock.suspend();
    clock += LOCK_GRACE_MS - 1_000;
    lock.refresh();

    expect(lock.getState().locked).toBe(false);
  });

  it("locks once the app has been away longer than that", async () => {
    const lock = controllerWith(memoryStore());
    await lock.enableLock("1234");

    lock.suspend();
    clock += LOCK_GRACE_MS + 1_000;
    lock.refresh();

    expect(lock.getState().locked).toBe(true);
  });

  it("restarts the grace interval on every foreground heartbeat", async () => {
    // A page left open all evening must not demand a PIN on the next reload.
    const lock = controllerWith(memoryStore());
    await lock.enableLock("1234");

    for (let i = 0; i < 10; i += 1) {
      clock += LOCK_GRACE_MS / 2;
      lock.touchNow();
    }
    clock += LOCK_GRACE_MS - 1;
    lock.refresh();

    expect(lock.getState().locked).toBe(false);
  });
});

describe("entering the PIN", () => {
  it("opens the app and forgets the failures", async () => {
    const lock = controllerWith(memoryStore());
    await lock.enableLock("1234");
    lock.suspend();
    clock += LOCK_GRACE_MS + 1;
    lock.refresh();

    expect(await lock.submitPin("0000")).toBe(false);
    expect(await lock.submitPin("1234")).toBe(true);
    expect(lock.getState()).toMatchObject({ locked: false, failures: 0 });
  });

  it("counts a wrong PIN and keeps the app shut", async () => {
    const lock = controllerWith(memoryStore());
    await lock.enableLock("1234");
    lock.suspend();
    clock += LOCK_GRACE_MS + 1;
    lock.refresh();

    expect(await lock.submitPin("0000")).toBe(false);

    expect(lock.getState()).toMatchObject({ locked: true, failures: 1, blockedForMs: 0 });
  });

  it("makes the fourth wrong PIN wait, and never locks the leader out for good", async () => {
    const lock = controllerWith(memoryStore());
    await lock.enableLock("1234");
    lock.suspend();
    clock += LOCK_GRACE_MS + 1;
    lock.refresh();

    for (let i = 0; i < 4; i += 1) await lock.submitPin("0000");
    expect(lock.getState().blockedForMs).toBe(5_000);

    // The right PIN entered during the wait is refused, but the wait is not
    // extended for trying — otherwise a leader tapping at it never gets in.
    expect(await lock.submitPin("1234")).toBe(false);
    expect(lock.getState().failures).toBe(4);

    clock += 5_000;
    expect(await lock.submitPin("1234")).toBe(true);
    expect(lock.getState().locked).toBe(false);
  });

  it("remembers the backoff across a reload", async () => {
    const store = memoryStore();
    await controllerWith(store).enableLock("1234");
    clock += LOCK_GRACE_MS + 1;

    const first = controllerWith(store);
    first.refresh();
    for (let i = 0; i < 4; i += 1) await first.submitPin("0000");
    // The fifth attempt has to wait out the fourth's five seconds — an attempt
    // made during the backoff is refused without being counted.
    clock += 5_000;
    await first.submitPin("0000");

    const afterReload = controllerWith(store);
    afterReload.refresh();

    expect(afterReload.getState()).toMatchObject({ locked: true, failures: 5 });
    expect(afterReload.getState().blockedForMs).toBe(15_000);
  });
});

describe("the fingerprint", () => {
  it("registers a credential and turns biometric unlock on", async () => {
    const store = memoryStore();
    const lock = controllerWith(store);
    await lock.enableLock("1234");

    expect(await lock.enableBiometric()).toBe(true);

    expect(store.record?.credentialId).toBeTruthy();
    expect(lock.getState().biometric).toBe(true);
  });

  it("unlocks with it", async () => {
    const lock = controllerWith(memoryStore());
    await lock.enableLock("1234");
    await lock.enableBiometric();
    lock.suspend();
    clock += LOCK_GRACE_MS + 1;
    lock.refresh();

    expect(await lock.unlockWithBiometric()).toBe(true);
    expect(lock.getState().locked).toBe(false);
  });

  it("does nothing when no fingerprint was ever registered", async () => {
    const lock = controllerWith(memoryStore());
    await lock.enableLock("1234");
    lock.suspend();
    clock += LOCK_GRACE_MS + 1;
    lock.refresh();

    expect(await lock.unlockWithBiometric()).toBe(false);
    expect(lock.getState().locked).toBe(true);
  });

  it("turns off without touching the PIN", async () => {
    const store = memoryStore();
    const lock = controllerWith(store);
    await lock.enableLock("1234");
    await lock.enableBiometric();

    lock.disableBiometric();

    expect(store.record?.credentialId).toBeNull();
    expect(lock.getState()).toMatchObject({ enabled: true, biometric: false });
  });

  it("is unavailable on a device with no WebAuthn at all", async () => {
    const lock = controllerWith(memoryStore(), null);
    await lock.enableLock("1234");

    expect(await lock.enableBiometric()).toBe(false);
    expect(lock.getState().biometric).toBe(false);
  });
});

describe("the account", () => {
  it("drops a lock left behind by a different account (#19 — the account is the identity)", async () => {
    const store = memoryStore();
    await controllerWith(store).enableLock("1234");
    clock += LOCK_GRACE_MS + 1;

    const someoneElse = createLockController({
      account: "other@example.com",
      store,
      now,
      webauthn: fakeWebAuthn(),
      iterations: ITERATIONS,
    });
    someoneElse.refresh();

    expect(store.record).toBeNull();
    expect(someoneElse.getState()).toMatchObject({ enabled: false, locked: false });
  });

  it("is forgotten on sign-out, so signing back in starts without a lock", async () => {
    const store = memoryStore();
    const lock = controllerWith(store);
    await lock.enableLock("1234");

    lock.forget();

    expect(store.record).toBeNull();
    expect(lock.getState()).toMatchObject({ enabled: false, locked: false });
  });
});

describe("switching the lock off", () => {
  it("clears the device record", async () => {
    const store = memoryStore();
    const lock = controllerWith(store);
    await lock.enableLock("1234");

    lock.disableLock();

    expect(store.record).toBeNull();
    expect(lock.getState().enabled).toBe(false);
  });
});

describe("changing the PIN", () => {
  it("takes the new one and refuses the old one", async () => {
    const lock = controllerWith(memoryStore());
    await lock.enableLock("1234");
    await lock.changePin("5678");

    lock.suspend();
    clock += LOCK_GRACE_MS + 1;
    lock.refresh();

    expect(await lock.submitPin("1234")).toBe(false);
    expect(await lock.submitPin("5678")).toBe(true);
  });
});
