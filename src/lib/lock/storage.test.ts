import { describe, expect, it, vi } from "vitest";

import {
  LOCK_ARMED_COOKIE,
  LOCK_STORAGE_KEY,
  armedCookie,
  createLockStore,
  parseRecord,
} from "./storage";
import type { LockRecord } from "./state";

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

function fakeStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

describe("parseRecord", () => {
  it("reads back what was written", () => {
    expect(parseRecord(JSON.stringify(RECORD))).toEqual(RECORD);
  });

  it("is null for nothing stored", () => {
    expect(parseRecord(null)).toBeNull();
  });

  it("is null for junk rather than throwing", () => {
    // Whatever else a corrupted key does, it must not put the app in a state
    // where the lock screen cannot decide and the leader cannot get in.
    expect(parseRecord("not json")).toBeNull();
    expect(parseRecord("null")).toBeNull();
    expect(parseRecord("[]")).toBeNull();
  });

  it("is null for a record from a future version of the app", () => {
    expect(parseRecord(JSON.stringify({ ...RECORD, version: 2 }))).toBeNull();
  });

  it("is null when a field the lock depends on is missing", () => {
    const withoutHash: Partial<LockRecord> = { ...RECORD };
    delete withoutHash.hash;
    expect(parseRecord(JSON.stringify(withoutHash))).toBeNull();

    expect(parseRecord(JSON.stringify({ ...RECORD, lastSeenAt: "soon" }))).toBeNull();
  });
});

describe("armedCookie", () => {
  it("arms the server-side hint for a year", () => {
    const value = armedCookie(true);

    expect(value).toContain(`${LOCK_ARMED_COOKIE}=1`);
    expect(value).toContain("path=/");
    expect(value).toContain("samesite=lax");
    expect(value).toMatch(/max-age=\d{7,}/);
  });

  it("expires it when the lock is switched off", () => {
    const value = armedCookie(false);

    expect(value).toContain(`${LOCK_ARMED_COOKIE}=`);
    expect(value).toContain("max-age=0");
  });
});

describe("createLockStore", () => {
  it("writes the record under one key and arms the cookie with it", () => {
    const storage = fakeStorage();
    const setCookie = vi.fn();

    createLockStore(storage, setCookie).write(RECORD);

    expect(parseRecord(storage.getItem(LOCK_STORAGE_KEY))).toEqual(RECORD);
    // The cookie is how the server-rendered shell knows to draw the lock screen
    // first, so it can never drift from the record — hence one writer.
    expect(setCookie).toHaveBeenCalledWith(armedCookie(true));
  });

  it("reads a stored record back", () => {
    const storage = fakeStorage({ [LOCK_STORAGE_KEY]: JSON.stringify(RECORD) });

    expect(createLockStore(storage, vi.fn()).read()).toEqual(RECORD);
  });

  it("clears the record and disarms the cookie together", () => {
    const storage = fakeStorage({ [LOCK_STORAGE_KEY]: JSON.stringify(RECORD) });
    const setCookie = vi.fn();

    createLockStore(storage, setCookie).clear();

    expect(storage.getItem(LOCK_STORAGE_KEY)).toBeNull();
    expect(setCookie).toHaveBeenCalledWith(armedCookie(false));
  });

  it("survives storage that throws", () => {
    // Private-mode Safari and a full quota both throw from `setItem`. A lock
    // that cannot persist should leave the app usable, not crash the shell.
    const throwing = {
      getItem: () => {
        throw new Error("nope");
      },
      setItem: () => {
        throw new Error("nope");
      },
      removeItem: () => {
        throw new Error("nope");
      },
    };
    const store = createLockStore(throwing, vi.fn());

    expect(store.read()).toBeNull();
    expect(() => store.write(RECORD)).not.toThrow();
    expect(() => store.clear()).not.toThrow();
  });
});
