"use client";

/**
 * The APP LOCK card on Settings — `design/Settings.dc.html`, its second group:
 * a switch that turns the PIN on, and once it is on, a fingerprint switch and
 * "Change PIN" underneath.
 *
 * All three act on this device only. Turning the lock on here does not put a
 * PIN in front of the leader's laptop, and turning it off there does not remove
 * this one (#19 — the lock protects a phone, the account is what protects the
 * records).
 *
 * The fingerprint row is hidden entirely on a device with no sensor, rather
 * than shown dead: the board draws it because the board is drawn on a phone
 * that has one.
 */
import { useEffect, useState } from "react";

import { PinPad } from "@/components/PinPad";
import { useLock } from "@/components/AppLock";
import { PIN_LENGTH } from "@/lib/lock/state";
import { platformAuthenticatorAvailable } from "@/lib/lock/webauthn";

type Sheet =
  | { kind: "none" }
  | { kind: "choose"; mode: "set" | "change"; note?: string }
  | { kind: "confirm"; mode: "set" | "change"; first: string };

export function LockSettings() {
  const { view, controller } = useLock();
  const [sheet, setSheet] = useState<Sheet>({ kind: "none" });
  const [entry, setEntry] = useState("");
  const [hasSensor, setHasSensor] = useState(false);

  useEffect(() => {
    let live = true;
    void platformAuthenticatorAvailable().then((available) => {
      if (live) setHasSensor(available);
    });
    return () => void (live = false);
  }, []);

  function open(mode: "set" | "change") {
    setEntry("");
    setSheet({ kind: "choose", mode });
  }

  function close() {
    setEntry("");
    setSheet({ kind: "none" });
  }

  async function complete(mode: "set" | "change", pin: string) {
    if (!controller) return;
    if (mode === "set") await controller.enableLock(pin);
    else await controller.changePin(pin);
    close();
  }

  function press(digit: string) {
    if (sheet.kind === "none" || entry.length >= PIN_LENGTH) return;

    const next = entry + digit;
    if (next.length < PIN_LENGTH) {
      setEntry(next);
      return;
    }

    setEntry("");
    if (sheet.kind === "choose") {
      setSheet({ kind: "confirm", mode: sheet.mode, first: next });
    } else if (next === sheet.first) {
      void complete(sheet.mode, next);
    } else {
      // Mismatched confirmation: back to the first step, said plainly.
      setSheet({ kind: "choose", mode: sheet.mode, note: "Those did not match. Start again." });
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-[20px] border border-line bg-card">
        <button
          type="button"
          disabled={!view.ready}
          aria-pressed={view.enabled}
          onClick={() => (view.enabled ? controller?.disableLock() : open("set"))}
          className="flex w-full items-center gap-3 px-[15px] py-[14px] text-left active:bg-shell"
        >
          <span className="min-w-0 grow">
            <span className="block text-[15.5px] font-bold">Require a PIN to open</span>
            <span className="mt-[2px] block text-[13.5px] text-slate">
              People&rsquo;s notes stay private if the phone is left open.
            </span>
          </span>
          <Switch on={view.enabled} />
        </button>

        {view.enabled ? (
          <>
            {hasSensor ? (
              <>
                <div className="ml-[15px] h-px bg-line-soft" />
                <button
                  type="button"
                  disabled={!view.ready}
                  aria-pressed={view.biometric}
                  onClick={() =>
                    view.biometric ? controller?.disableBiometric() : void controller?.enableBiometric()
                  }
                  className="flex w-full items-center gap-3 px-[15px] py-[14px] text-left active:bg-shell"
                >
                  <span className="min-w-0 grow text-[15.5px] font-bold">
                    Unlock with fingerprint
                  </span>
                  <Switch on={view.biometric} />
                </button>
              </>
            ) : null}

            <div className="ml-[15px] h-px bg-line-soft" />
            <button
              type="button"
              disabled={!view.ready}
              onClick={() => open("change")}
              className="block w-full px-[15px] py-4 text-left text-[15.5px] font-semibold text-blue active:bg-shell"
            >
              Change PIN
            </button>
          </>
        ) : null}
      </div>

      {sheet.kind === "none" ? null : (
        <div className="fixed inset-0 z-10 overflow-y-auto bg-sand">
          <PinPad
            title={sheet.kind === "choose" ? "Choose a PIN" : "Enter it again"}
            note={
              sheet.kind === "choose"
                ? (sheet.note ??
                  "Four digits. You will enter these when you open Bible Study Tayo.")
                : "Once more, so a mistyped digit does not lock you out."
            }
            noteTone={sheet.kind === "choose" && sheet.note ? "alert" : "muted"}
            entered={entry.length}
            open
            onDigit={press}
            onBackspace={() => setEntry(entry.slice(0, -1))}
          >
            <button
              type="button"
              onClick={close}
              className="mt-[14px] flex h-[52px] w-full items-center justify-center text-[15.5px] font-semibold text-slate"
            >
              Cancel
            </button>
          </PinPad>
        </div>
      )}
    </>
  );
}

/** The board's 52×32 track with a 26px knob. */
function Switch({ on }: { on: boolean }) {
  return (
    <span
      className={`flex h-8 w-[52px] shrink-0 items-center rounded-2xl p-[3px] ${
        on ? "justify-end bg-blue" : "justify-start bg-track"
      }`}
      aria-hidden="true"
    >
      <span className="block h-[26px] w-[26px] rounded-[13px] bg-card" />
    </span>
  );
}
