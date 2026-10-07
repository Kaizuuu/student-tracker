"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }

    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // The app remains usable online if the browser blocks service workers.
    });
  }, []);

  return null;
}
