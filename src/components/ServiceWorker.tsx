"use client";

/**
 * Registers `/sw.js`. One effect, no UI.
 *
 * Registration is skipped in development: a worker that has claimed the page
 * will happily serve a cached build over the one that is being edited, and the
 * hour spent finding out why a change "did not apply" is not worth what it buys
 * locally. It is installability that needs the worker, and that is a property
 * of the deployed app.
 */
import { useEffect } from "react";

export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // After load, so registering never competes with the first render for
    // bandwidth on a phone.
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((thrown) => {
        console.warn("[sw] registration failed", thrown);
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
