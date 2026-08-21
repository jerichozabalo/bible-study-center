/**
 * The server half of the app lock: one cookie read, so the shell knows whether
 * to paint the lock screen before it paints anything else.
 *
 * It exists so `(shell)/layout.tsx` stays what it is — header, scroll region,
 * tab bar — instead of growing lock plumbing. The cookie is a hint written by
 * the device (see `lib/lock/storage.ts`); the record in `localStorage` is the
 * truth, and the client corrects a stale hint on mount.
 */
import { cookies } from "next/headers";

import { AppLock } from "@/components/AppLock";
import { LOCK_ARMED_COOKIE } from "@/lib/lock/storage";

export async function AppLockBoundary({
  account,
  children,
}: {
  account: string;
  children: React.ReactNode;
}) {
  const armed = (await cookies()).get(LOCK_ARMED_COOKIE)?.value === "1";

  return (
    <AppLock account={account} armedAtBoot={armed}>
      {children}
    </AppLock>
  );
}
