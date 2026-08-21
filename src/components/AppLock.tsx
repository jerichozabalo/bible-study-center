"use client";

/**
 * The gate in front of the app shell (#19).
 *
 * It wraps the shell rather than living inside a screen, because "reopening the
 * app asks for the PIN before showing any roster data" is a property of the
 * whole app, not of one page. The children stay MOUNTED and hidden while
 * locked, so unlocking returns the leader to the screen and the scroll position
 * they left — the lock is a curtain, not a logout.
 *
 * Be clear about what that is worth: hidden markup is still markup, and the
 * server-rendered payload is still in the page. This gates the UI, it is not
 * encryption — the rejected alternative on #19's line. It is aimed at a phone
 * that was borrowed or left on a table, not at someone with devtools open.
 *
 * The lock's own state lives in `lib/lock/`, where it is tested without a
 * browser. This component subscribes, listens for the app going away and coming
 * back, and draws.
 */
import { createContext, useContext, useEffect, useState } from "react";

import { LockScreen } from "@/components/LockScreen";
import { type LockController, type LockView, createLockController } from "@/lib/lock/controller";
import { LOCK_HEARTBEAT_MS } from "@/lib/lock/state";
import { browserLockStore } from "@/lib/lock/storage";
import { browserWebAuthn } from "@/lib/lock/webauthn";

type LockContextValue = {
  view: LockView;
  /** Null until the device record has been read — i.e. until after hydration. */
  controller: LockController | null;
};

/**
 * The first render, on the server and again on the client before the effect
 * runs, has no access to `localStorage`. The `bst_lock` cookie carries the one
 * bit it needs — "this device has a PIN" — so a cold open paints the lock
 * screen instead of painting the roster and covering it a beat later.
 */
function bootView(armed: boolean): LockView {
  return {
    ready: false,
    enabled: armed,
    locked: armed,
    biometric: false,
    failures: 0,
    blockedForMs: 0,
  };
}

const LockContext = createContext<LockContextValue>({
  view: bootView(false),
  controller: null,
});

/** For the lock screen and the Settings rows — the only two consumers. */
export function useLock(): LockContextValue {
  return useContext(LockContext);
}

export function AppLock({
  account,
  armedAtBoot,
  children,
}: {
  account: string;
  armedAtBoot: boolean;
  children: React.ReactNode;
}) {
  const [view, setView] = useState<LockView>(() => bootView(armedAtBoot));
  /**
   * Built once, lazily, and never on the server — it reaches for
   * `localStorage`. It reads nothing until `refresh()`, so constructing it
   * during the first client render changes no markup: the view still comes from
   * `bootView`, and hydration matches what the server sent.
   *
   * It captures `account`, which is safe because a different account can only
   * arrive through sign-out and sign-in — a full page load, and a fresh one of
   * these.
   */
  const [controller] = useState<LockController | null>(() =>
    typeof window === "undefined"
      ? null
      : createLockController({
          account,
          store: browserLockStore(),
          now: () => Date.now(),
          webauthn: browserWebAuthn(),
        }),
  );

  useEffect(() => {
    const lock = controller;
    if (!lock) return;

    const unsubscribe = lock.subscribe(() => setView(lock.getState()));
    lock.refresh();

    const onVisibilityChange = () => {
      // Going away starts the grace interval; coming back is what decides
      // whether it ran out (`LOCK_GRACE_MS`).
      if (document.visibilityState === "hidden") lock.suspend();
      else lock.refresh();
    };
    const onPageHide = () => lock.suspend();

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    // A page held in the foreground all evening keeps its stamp fresh, or the
    // next reload would ask for a PIN the leader never walked away from.
    const heartbeat = window.setInterval(() => lock.touchNow(), LOCK_HEARTBEAT_MS);

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.clearInterval(heartbeat);
    };
  }, [controller]);

  return (
    <LockContext.Provider value={{ view, controller }}>
      <div hidden={view.locked}>{children}</div>
      {view.locked ? <LockScreen /> : null}
    </LockContext.Provider>
  );
}
