/**
 * The app lock's state machine (#19), pure and device-local.
 *
 * #19 buys one thing: the roster is not open on a phone that was borrowed or
 * left on a table. It is a gate in front of the UI, NOT encryption — end-to-end
 * encryption was the rejected alternative on that same line. Whoever holds the
 * phone and knows how to open devtools can read the records anyway; that is not
 * the person this protects against.
 *
 * Which is why the lock is per-DEVICE and not a row on the server: a gate that
 * protects THIS phone is naturally this phone's own state, and a server-side
 * PIN would be one PIN shared across every device the leader ever signs in on.
 * The account stays the identity (#19: a forgotten PIN is recovered by signing
 * in with Google again), so the record names the account it belongs to and
 * means nothing to any other one.
 *
 * Everything here takes `now` as an argument and returns a new record. The
 * browser halves — `localStorage` and WebAuthn — live behind the adapters in
 * `storage.ts` and `webauthn.ts`, so all of the behaviour below is testable
 * without one.
 */

/** How long the app may be away before it asks for the PIN again.
 *
 * Never specified, so: one minute. Long enough to answer a text, read the
 * address of the venue, or paste something in from another app in the middle of
 * taking attendance — the app is used one-handed in a room, and re-entering a
 * PIN after every glance away would get the lock switched off. Short enough
 * that a phone put down on a table is locked by the time anyone picks it up.
 */
export const LOCK_GRACE_MS = 60_000;

/**
 * How often a foreground page restamps `lastSeenAt`. Without this, a page left
 * open all evening would carry a stale timestamp and demand a PIN on the next
 * reload even though the leader never left it. A quarter of the grace interval
 * keeps the stamp fresh at four cheap writes a minute.
 */
export const LOCK_HEARTBEAT_MS = LOCK_GRACE_MS / 4;

/** Four digits, as the SignIn board draws it — four dots, no confirm key. */
export const PIN_LENGTH = 4;

/**
 * What each consecutive wrong PIN costs, in milliseconds, indexed by failure
 * count. Deliberately NOT a hard lockout: this is a personal ministry tool, and
 * "too many attempts, locked" would strand Jericho out of his own roster in the
 * middle of a meeting with the room waiting. Three free tries cover a mistyped
 * digit; after that the delay escalates to a minute and stays there, which is
 * fatal to guessing 10,000 PINs and survivable for the person who owns the
 * phone. The Google re-auth escape hatch (#19) is always available anyway.
 */
const BACKOFF_MS = [0, 0, 0, 0, 5_000, 15_000, 30_000, 60_000];

/**
 * What is kept on the device. The PIN itself is never here — only a PBKDF2
 * hash and its salt (see `pin.ts`).
 */
export type LockRecord = {
  version: 1;
  /** The signed-in account this lock guards. */
  account: string;
  /** PBKDF2 salt, base64url. */
  salt: string;
  /** PBKDF2 hash of the PIN, base64url. Never the PIN. */
  hash: string;
  iterations: number;
  /** WebAuthn platform credential id (base64url), or null when biometric unlock is off. */
  credentialId: string | null;
  /** When the app was last known to be in the leader's hands, ms epoch. */
  lastSeenAt: number;
  /** Consecutive wrong PINs since the last successful unlock. */
  failures: number;
  /** When the most recent wrong PIN was entered, ms epoch; 0 when there is none. */
  lastFailureAt: number;
};

export type LockStatus =
  | { kind: "off" }
  | { kind: "unlocked" }
  | { kind: "locked"; failures: number; blockedForMs: number };

/** The delay owed after `failures` consecutive wrong PINs. */
export function retryDelayMs(failures: number): number {
  if (failures < 0) return 0;
  return BACKOFF_MS[Math.min(failures, BACKOFF_MS.length - 1)];
}

/** How much of that delay is still to run. */
export function blockedForMs(record: LockRecord, now: number): number {
  const until = record.lastFailureAt + retryDelayMs(record.failures);
  return Math.max(0, until - now);
}

/** Whether a stored record is this account's to obey. */
export function belongsTo(record: LockRecord | null, account: string): record is LockRecord {
  return record !== null && record.account === account;
}

/**
 * The lock's state right now: off (no PIN on this device), unlocked (the app
 * was in use moments ago), or locked.
 */
export function statusFor(record: LockRecord | null, account: string, now: number): LockStatus {
  if (!belongsTo(record, account)) return { kind: "off" };

  const away = now - record.lastSeenAt;
  // A negative `away` means the clock moved backwards — treat it as locked
  // rather than as an unbounded grace interval.
  if (away >= 0 && away <= LOCK_GRACE_MS) return { kind: "unlocked" };

  return { kind: "locked", failures: record.failures, blockedForMs: blockedForMs(record, now) };
}

/** Restamp the grace interval: the app is in the foreground, in use. */
export function touch(record: LockRecord, now: number): LockRecord {
  return { ...record, lastSeenAt: now };
}

/** A wrong PIN: count it, but do not treat it as the leader being present. */
export function afterWrongPin(record: LockRecord, now: number): LockRecord {
  return { ...record, failures: record.failures + 1, lastFailureAt: now };
}

/** Unlocked, by PIN or by fingerprint: forget the failures, start the grace interval. */
export function afterUnlock(record: LockRecord, now: number): LockRecord {
  return { ...record, failures: 0, lastFailureAt: 0, lastSeenAt: now };
}
