"use client";

/**
 * What the leader sees when the app is locked — `design/SignIn.dc.html` in its
 * `pin` state, made to work.
 *
 * Two things the board does not draw, both required by #19:
 *  - "Forgot your PIN?" — the PIN is not the identity, the ACCOUNT is, so the
 *    recovery is to sign in with Google again. It signs out first and clears
 *    this device's lock, in that order: clearing without signing out would hand
 *    whoever is holding the phone a still-valid session with no gate in front
 *    of it. After it, only someone who can pass Google AND the allowlist gets
 *    back in.
 *  - The wrong-PIN backoff, which the note under the title reports in words.
 */
import { useEffect, useState } from "react";

import { useLock } from "@/components/AppLock";
import { PinPad } from "@/components/PinPad";
import { PIN_LENGTH } from "@/lib/lock/state";

const RESTING_NOTE = "Protects your members’ details if your phone is borrowed or lost.";

export function LockScreen() {
  const { view, controller } = useLock();
  const [entry, setEntry] = useState("");
  const [wrong, setWrong] = useState(false);
  const [blockedMs, setBlockedMs] = useState(view.blockedForMs);

  // The backoff counts down while this screen sits there, so it has to be read
  // from the controller rather than from the last render's view.
  useEffect(() => {
    if (!controller) return;
    const tick = window.setInterval(() => setBlockedMs(controller.getState().blockedForMs), 250);
    return () => window.clearInterval(tick);
  }, [controller]);

  async function submit(pin: string) {
    if (!controller) return;
    const unlocked = await controller.submitPin(pin);
    if (!unlocked) {
      setWrong(true);
      setEntry("");
      setBlockedMs(controller.getState().blockedForMs);
    }
  }

  function press(digit: string) {
    if (!controller || entry.length >= PIN_LENGTH) return;
    setWrong(false);

    const next = entry + digit;
    setEntry(next);
    if (next.length === PIN_LENGTH) void submit(next);
  }

  const waitSeconds = Math.ceil(blockedMs / 1000);
  const note = blockedMs > 0
    ? `Too many tries. Try again in ${waitSeconds} second${waitSeconds === 1 ? "" : "s"}.`
    : wrong
      ? "That PIN did not match. Try again."
      : RESTING_NOTE;

  return (
    <PinPad
      title="Enter your PIN"
      note={note}
      noteTone={blockedMs > 0 || wrong ? "alert" : "muted"}
      entered={entry.length}
      onDigit={press}
      onBackspace={() => {
        setWrong(false);
        setEntry(entry.slice(0, -1));
      }}
    >
      {view.biometric ? (
        <button
          type="button"
          onClick={() => void controller?.unlockWithBiometric()}
          className="mt-[14px] flex h-[52px] items-center justify-center gap-[9px] text-[15.5px] font-bold text-blue"
        >
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#1D4E89"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3a7 7 0 0 0-7 7v3M12 3a7 7 0 0 1 7 7v6M8.5 21a11 11 0 0 0 1.5-6v-5a2 2 0 0 1 4 0v5M12 21v-4" />
          </svg>
          Use fingerprint
        </button>
      ) : null}

      <form
        action="/auth/signout"
        method="post"
        onSubmit={() => controller?.forget()}
        className={view.biometric ? "" : "mt-[14px]"}
      >
        <button
          type="submit"
          className="flex h-[46px] w-full items-center justify-center text-[14.5px] font-semibold text-slate"
        >
          Forgot your PIN? Sign in with Google again
        </button>
      </form>
    </PinPad>
  );
}
