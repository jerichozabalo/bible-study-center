/**
 * The lock, driven: the one object the lock screen and the Settings rows both
 * talk to. It holds the current record, persists every change through the
 * injected store, and tells subscribers when the view changed.
 *
 * React is not imported here on purpose. The clock, the storage and WebAuthn
 * are all arguments, which is what makes the whole of the lock's behaviour
 * testable in Node — the component on top of it (`components/AppLock.tsx`) is
 * left with subscribing and drawing.
 */
import { createLockRecord, setPin, verifyPin } from "./pin";
import {
  type LockRecord,
  afterUnlock,
  afterWrongPin,
  blockedForMs,
  belongsTo,
  statusFor,
  touch,
} from "./state";
import type { LockStore } from "./storage";
import {
  type WebAuthnApi,
  registerPlatformCredential,
  unlockWithPlatformCredential,
} from "./webauthn";

/** Everything both screens need to draw themselves. */
export type LockView = {
  /** False until the device record has actually been read. */
  ready: boolean;
  /** Whether this device has a PIN at all. */
  enabled: boolean;
  /** Whether the gate is in front of the app right now. */
  locked: boolean;
  /** Whether a fingerprint is registered on this device. */
  biometric: boolean;
  failures: number;
  /** How long until another PIN attempt is accepted. */
  blockedForMs: number;
};

export type LockController = {
  getState(): LockView;
  subscribe(listener: () => void): () => void;
  /** Read the device record and decide: app open, or lock screen. */
  refresh(): void;
  /** The app is in the foreground and in use — extend the grace interval. */
  touchNow(): void;
  /** The app is going away — the grace interval runs from now. */
  suspend(): void;
  submitPin(pin: string): Promise<boolean>;
  unlockWithBiometric(): Promise<boolean>;
  enableLock(pin: string): Promise<void>;
  changePin(pin: string): Promise<void>;
  disableLock(): void;
  enableBiometric(): Promise<boolean>;
  disableBiometric(): void;
  /** Sign-out and the forgotten-PIN path: this device's lock is gone. */
  forget(): void;
};

export function createLockController(options: {
  account: string;
  store: LockStore;
  now: () => number;
  webauthn: WebAuthnApi | null;
  /** Only lowered by the suite — PBKDF2 at the production count is slow by design. */
  iterations?: number;
}): LockController {
  const { account, store, now, webauthn, iterations } = options;

  let record: LockRecord | null = null;
  let ready = false;
  let unlocked = false;
  const listeners = new Set<() => void>();

  function emit(): void {
    for (const listener of listeners) listener();
  }

  function persist(next: LockRecord): void {
    record = next;
    store.write(next);
  }

  function view(): LockView {
    if (!record) {
      return { ready, enabled: false, locked: false, biometric: false, failures: 0, blockedForMs: 0 };
    }
    return {
      ready,
      enabled: true,
      locked: !unlocked,
      biometric: record.credentialId !== null,
      failures: record.failures,
      blockedForMs: blockedForMs(record, now()),
    };
  }

  function unlock(): void {
    if (!record) return;
    persist(afterUnlock(record, now()));
    unlocked = true;
  }

  return {
    getState: view,

    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },

    refresh() {
      const stored = store.read();

      // A lock left by a different Google account is not this account's to
      // obey (#19). Dropping it here is also what makes signing in as someone
      // else on a shared phone leave no gate behind.
      if (stored && !belongsTo(stored, account)) {
        store.clear();
        record = null;
      } else {
        record = stored;
      }

      ready = true;

      const status = statusFor(record, account, now());
      unlocked = status.kind !== "locked";
      // Coming back inside the grace interval counts as being here: the next
      // interval runs from the return, not from when the app was put down.
      if (record && unlocked) persist(touch(record, now()));

      emit();
    },

    touchNow() {
      if (!record || !unlocked) return;
      persist(touch(record, now()));
    },

    suspend() {
      if (!record || !unlocked) return;
      persist(touch(record, now()));
    },

    async submitPin(pin) {
      if (!record) return false;
      // Trying during the backoff costs nothing and earns nothing — punishing
      // it would leave a leader who keeps tapping permanently shut out.
      if (blockedForMs(record, now()) > 0) return false;

      if (await verifyPin(record, pin)) {
        unlock();
        emit();
        return true;
      }

      persist(afterWrongPin(record, now()));
      emit();
      return false;
    },

    async unlockWithBiometric() {
      if (!record?.credentialId || !webauthn) return false;

      const ok = await unlockWithPlatformCredential({
        credentialId: record.credentialId,
        api: webauthn,
      });
      if (!ok) return false;

      unlock();
      emit();
      return true;
    },

    async enableLock(pin) {
      persist(await createLockRecord({ pin, account, now: now(), iterations }));
      unlocked = true;
      ready = true;
      emit();
    },

    async changePin(pin) {
      if (!record) return;
      persist(await setPin(record, pin, iterations));
      emit();
    },

    disableLock() {
      store.clear();
      record = null;
      unlocked = true;
      emit();
    },

    async enableBiometric() {
      if (!record || !webauthn) return false;

      const credentialId = await registerPlatformCredential({ account, api: webauthn });
      if (!credentialId) return false;

      persist({ ...record, credentialId });
      emit();
      return true;
    },

    disableBiometric() {
      if (!record) return;
      persist({ ...record, credentialId: null });
      emit();
    },

    forget() {
      store.clear();
      record = null;
      unlocked = true;
      emit();
    },
  };
}
