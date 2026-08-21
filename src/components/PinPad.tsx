"use client";

/**
 * The four dots and the keypad, exactly as `design/SignIn.dc.html` draws them in
 * its `pin` state. Presentational only: it holds no PIN and no lock state — the
 * screens above it (the lock screen, and the Settings sheet that sets a PIN) own
 * the digits and decide what a full four means.
 *
 * Keys are 70px tall because this is tapped one-handed, standing up, in a room
 * (#30 — large targets).
 */
import { PIN_LENGTH } from "@/lib/lock/state";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"] as const;

export function PinPad({
  title,
  note,
  noteTone = "muted",
  entered,
  open,
  onDigit,
  onBackspace,
  children,
}: {
  title: string;
  note: string;
  /** `alert` draws the note in the ink colour — a wrong PIN should not read as help text. */
  noteTone?: "muted" | "alert";
  /** How many digits are in the buffer, 0..PIN_LENGTH. */
  entered: number;
  /** The open padlock, drawn once the PIN has been accepted. */
  open?: boolean;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  /** The affordances under the pad: fingerprint, forgotten PIN, cancel. */
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col px-[26px] pt-[70px] pb-[26px]">
      <div className="flex flex-col items-center">
        <div
          className={`flex h-[54px] w-[54px] items-center justify-center rounded-[19px] ${
            open ? "bg-blue-tint" : "bg-shell"
          }`}
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke={open ? "#1D4E89" : "#61708A"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="4" y="10" width="16" height="11" rx="3" />
            <path d={open ? "M8 10V7a4 4 0 0 1 7-2.6" : "M8 10V7a4 4 0 0 1 8 0v3"} />
          </svg>
        </div>

        <h2 className="mt-[17px] text-[22px]">{title}</h2>
        <p
          role={noteTone === "alert" ? "alert" : undefined}
          className={`mt-[7px] max-w-[250px] text-center text-[14.5px] leading-[1.45] ${
            noteTone === "alert" ? "font-semibold text-ink" : "text-slate"
          }`}
        >
          {note}
        </p>

        <div className="mt-[26px] flex gap-[14px]" aria-hidden="true">
          {Array.from({ length: PIN_LENGTH }, (_, index) => (
            <div
              key={index}
              className={`h-[17px] w-[17px] rounded-[10px] border-2 ${
                index < entered ? "border-blue bg-blue" : "border-stone bg-transparent"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="grow" />

      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((key, index) =>
          key === "" ? (
            <div key={index} />
          ) : (
            <button
              key={index}
              type="button"
              onClick={() => (key === "back" ? onBackspace() : onDigit(key))}
              aria-label={key === "back" ? "Delete" : key}
              className={`flex h-[70px] items-center justify-center rounded-[22px] text-[26px] font-semibold text-ink ${
                key === "back" ? "" : "bg-card active:bg-shell"
              }`}
            >
              {key === "back" ? (
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#61708A"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 5H9.5a2 2 0 0 0-1.5.7L3 12l5 6.3a2 2 0 0 0 1.5.7H20a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z" />
                  <path d="m17 9-5 6m0-6 5 6" />
                </svg>
              ) : (
                key
              )}
            </button>
          ),
        )}
      </div>

      {children}
    </div>
  );
}
