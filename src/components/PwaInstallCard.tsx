"use client";

import { usePwaInstall } from "@/components/PwaInstallProvider";

export default function PwaInstallCard() {
  const { prompt, installed, requestInstall } = usePwaInstall();

  return (
    <section aria-labelledby="install-app-heading" className="mt-8 rounded-3xl border border-border bg-surface p-5 sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Student Tracker app</p>
      <h2 id="install-app-heading" className="mt-1 text-xl font-semibold">Install on your device</h2>
      <p className="mt-3 text-sm leading-6 text-muted">
        Add Student Tracker to your Home Screen for an app-style window and the blue folder icon.
      </p>
      {installed ? (
        <p className="mt-4 rounded-2xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent">Student Tracker is installed on this device.</p>
      ) : prompt ? (
        <button type="button" onClick={() => void requestInstall()} className="mt-4 min-h-11 w-full rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90">
          Install Student Tracker
        </button>
      ) : (
        <div className="mt-4 rounded-2xl bg-background px-4 py-3 text-sm leading-6 text-muted">
          <p><span className="font-semibold text-foreground">Android Chrome:</span> open the ⋮ menu and choose <span className="font-medium text-foreground">Install app</span> or <span className="font-medium text-foreground">Add to Home screen</span>.</p>
          <p className="mt-2">If you already added an older version, remove its Home Screen icon and add it again to refresh the artwork.</p>
          <p className="mt-2"><span className="font-semibold text-foreground">iPhone:</span> in Safari, tap Share, then Add to Home Screen.</p>
        </div>
      )}
    </section>
  );
}
