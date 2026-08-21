/**
 * Where the device-local lock lives, and the one hint the server gets about it.
 *
 * `localStorage` holds the record — hash, salt, credential id, timestamps. It
 * is the truth, and it never leaves the phone.
 *
 * The cookie holds a single bit: "this device has a PIN". The server-rendered
 * shell reads it (`AppLockBoundary`) so a cold open paints the lock screen
 * FIRST instead of painting the roster and covering it a moment later once the
 * client has read `localStorage`. That flash is the exact moment the lock
 * exists to prevent, and there is no way to read `localStorage` before the
 * first paint of a server-rendered page.
 *
 * The bit is a hint, not an authority: it carries no PIN, no hash, and nothing
 * about the account, and if it is stale the client corrects it on mount. Both
 * are written in one place so they cannot drift.
 */
import type { LockRecord } from "./state";

export const LOCK_STORAGE_KEY = "bst.lock.v1";
export const LOCK_ARMED_COOKIE = "bst_lock";

/** A year: the lock outlives any session, and the client rewrites it anyway. */
const ARMED_COOKIE_SECONDS = 60 * 60 * 24 * 365;

export type LockStore = {
  read(): LockRecord | null;
  write(record: LockRecord): void;
  clear(): void;
};

/** The minimum of `Storage` this needs — which is what makes it fakeable. */
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function parseRecord(raw: string | null): LockRecord | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const record = parsed as Partial<LockRecord>;
  const wellFormed =
    record.version === 1 &&
    typeof record.account === "string" &&
    typeof record.salt === "string" &&
    typeof record.hash === "string" &&
    typeof record.iterations === "number" &&
    (record.credentialId === null || typeof record.credentialId === "string") &&
    typeof record.lastSeenAt === "number" &&
    typeof record.failures === "number" &&
    typeof record.lastFailureAt === "number";

  return wellFormed ? (record as LockRecord) : null;
}

/** `document.cookie` value that arms or disarms the server-side hint. */
export function armedCookie(armed: boolean): string {
  const age = armed ? ARMED_COOKIE_SECONDS : 0;
  return `${LOCK_ARMED_COOKIE}=${armed ? "1" : ""}; path=/; max-age=${age}; samesite=lax`;
}

export function createLockStore(
  storage: StorageLike,
  setCookie: (value: string) => void,
): LockStore {
  return {
    read() {
      try {
        return parseRecord(storage.getItem(LOCK_STORAGE_KEY));
      } catch {
        // Storage disabled entirely (private mode, blocked cookies): no lock.
        return null;
      }
    },
    write(record) {
      try {
        storage.setItem(LOCK_STORAGE_KEY, JSON.stringify(record));
      } catch {
        // Nothing useful to say to the leader here — the lock simply will not
        // persist on a device that refuses storage, and the app stays usable.
      }
      setCookie(armedCookie(true));
    },
    clear() {
      try {
        storage.removeItem(LOCK_STORAGE_KEY);
      } catch {
        // As above.
      }
      setCookie(armedCookie(false));
    },
  };
}

/** The real one: this browser's `localStorage` and this document's cookies. */
export function browserLockStore(): LockStore {
  return createLockStore(window.localStorage, (value) => {
    document.cookie = value;
  });
}
