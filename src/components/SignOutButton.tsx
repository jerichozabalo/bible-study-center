"use client";

/**
 * Sign out, and take this device's lock with it.
 *
 * The clearing has to happen here rather than in the route: the PIN lives in
 * `localStorage` and the server cannot reach it. Signing out and back in as the
 * same person therefore starts clean — which is what makes "a forgotten PIN is
 * recovered by signing in with Google again" (#19) true rather than aspirational.
 */
import { useLock } from "@/components/AppLock";

/** The Settings row. Home passes its own, because it draws a bordered pill. */
const AS_SETTINGS_ROW =
  "block w-full px-[15px] py-4 text-left text-[15.5px] font-semibold text-slate active:bg-shell";

/**
 * `className` exists so that every sign-out in the app comes through this
 * component rather than each screen posting to `/auth/signout` itself. Home had
 * its own bare form (issue 01, before the lock existed), which meant signing
 * out there left the PIN standing while signing out from Settings cleared it —
 * the same action with two behaviours, and #19's recovery route only true from
 * one of them. If a third screen ever needs a sign-out, give it a class, not a
 * second form.
 */
export function SignOutButton({ className }: { className?: string }) {
  const { controller } = useLock();

  return (
    <form
      action="/auth/signout"
      method="post"
      className={className ? "contents" : undefined}
      onSubmit={() => controller?.forget()}
    >
      <button type="submit" className={className ?? AS_SETTINGS_ROW}>
        Sign out
      </button>
    </form>
  );
}
