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

export function SignOutButton() {
  const { controller } = useLock();

  return (
    <form action="/auth/signout" method="post" onSubmit={() => controller?.forget()}>
      <button
        type="submit"
        className="block w-full px-[15px] py-4 text-left text-[15.5px] font-semibold text-slate active:bg-shell"
      >
        Sign out
      </button>
    </form>
  );
}
