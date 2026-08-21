/**
 * The PIN half of the lock: hashing it, and checking one against the hash.
 *
 * The PIN is never written anywhere. What is written is a PBKDF2-SHA256 hash
 * over a salt this install generated for itself, so the same PIN on two devices
 * produces two unrelated hashes and nothing in `localStorage` is a PIN.
 *
 * Be honest about what that buys. Four digits is 10,000 possibilities, and
 * anyone who can reach `localStorage` can reach the records the lock is in
 * front of — so the hash is not a serious defence against an attacker with the
 * device's storage in hand. It is here so that the PIN, which is very likely a
 * PIN the leader uses elsewhere, is not sitting in plain text on the phone.
 * The lock's actual job is #19's: the roster is not open on a borrowed phone.
 */
import { fromBase64Url, randomBytes, toBase64Url } from "./bytes";
import { PIN_LENGTH, type LockRecord } from "./state";

/**
 * Slow on purpose — this runs once per unlock, where a fraction of a second is
 * invisible, and 250k iterations turns an offline sweep of all 10,000 PINs from
 * instant into something that takes a while. OWASP's PBKDF2-SHA256 floor.
 */
export const PBKDF2_ITERATIONS = 250_000;

const PIN_PATTERN = new RegExp(`^\\d{${PIN_LENGTH}}$`);

export function isValidPin(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

export async function derivePinHash(
  pin: string,
  salt: string,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromBase64Url(salt), iterations },
    key,
    256,
  );
  return toBase64Url(new Uint8Array(bits));
}

/** A brand new lock for this device and this account. */
export async function createLockRecord(options: {
  pin: string;
  account: string;
  now: number;
  iterations?: number;
}): Promise<LockRecord> {
  const { pin, account, now, iterations = PBKDF2_ITERATIONS } = options;
  if (!isValidPin(pin)) throw new Error(`A PIN is ${PIN_LENGTH} digits — four digits, nothing else.`);

  const salt = toBase64Url(randomBytes(16));

  return {
    version: 1,
    account,
    salt,
    hash: await derivePinHash(pin, salt, iterations),
    iterations,
    credentialId: null,
    lastSeenAt: now,
    failures: 0,
    lastFailureAt: 0,
  };
}

/**
 * Change the PIN on an existing lock. The registered fingerprint survives it —
 * it is the same device and the same account, and re-registering a platform
 * credential just to change four digits would be a prompt with no purpose.
 */
export async function setPin(
  record: LockRecord,
  pin: string,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<LockRecord> {
  if (!isValidPin(pin)) throw new Error(`A PIN is ${PIN_LENGTH} digits — four digits, nothing else.`);

  const salt = toBase64Url(randomBytes(16));

  return {
    ...record,
    salt,
    hash: await derivePinHash(pin, salt, iterations),
    iterations,
    failures: 0,
    lastFailureAt: 0,
  };
}

export async function verifyPin(record: LockRecord, pin: string): Promise<boolean> {
  if (!isValidPin(pin)) return false;
  const candidate = await derivePinHash(pin, record.salt, record.iterations);
  return timingSafeEqual(candidate, record.hash);
}

/**
 * Compare without leaking the position of the first difference. Overkill for a
 * local gate — the attacker who could time this could also just read the hash —
 * but a hash comparison written the naive way is the kind of thing that gets
 * copied into somewhere it matters.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
