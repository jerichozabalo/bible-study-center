"use client";

/**
 * The "this screen needs a connection" note for Settings and Reports (#72 as
 * amended 2026-09-02, issue 18 Tier 2).
 *
 * The outbox covers exactly one write path — attendance, meetings, and now the
 * roster (#72). Settings and Reports stay online-only by decision, so instead
 * of a pending state they get a plain line when the phone is offline, and
 * nothing at all when it is online. Mirrors the `navigator.onLine` check the
 * roster forms already use.
 */
import { useEffect, useState } from "react";

export function OnlineOnlyNote({ what }: { what: "Settings" | "Reports" }) {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (online) return null;

  return (
    <p className="mt-[14px] rounded-[16px] border border-line bg-shell px-[14px] py-[12px] text-[13.5px] leading-[1.45] text-slate">
      You’re offline. {what} need a connection — attendance and roster changes
      still save on this phone, but this screen will only work again once
      you reconnect.
    </p>
  );
}
