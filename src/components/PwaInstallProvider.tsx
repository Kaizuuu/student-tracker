"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type PwaInstallContextValue = {
  prompt: InstallPromptEvent | null;
  installed: boolean;
  requestInstall: () => Promise<boolean>;
};

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);

export function usePwaInstall() {
  const context = useContext(PwaInstallContext);
  if (!context) throw new Error("usePwaInstall must be used within PwaInstallProvider");
  return context;
}

export default function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const updateInstalled = () => {
      const iosStandalone = "standalone" in window.navigator && Boolean(window.navigator.standalone);
      setInstalled(standaloneQuery.matches || iosStandalone);
    };
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const onAppInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };

    updateInstalled();
    standaloneQuery.addEventListener("change", updateInstalled);
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      standaloneQuery.removeEventListener("change", updateInstalled);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const value = useMemo<PwaInstallContextValue>(() => ({
    prompt,
    installed,
    requestInstall: async () => {
      if (!prompt) return false;
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setPrompt(null);
      return choice.outcome === "accepted";
    },
  }), [prompt, installed]);

  return <PwaInstallContext.Provider value={value}>{children}</PwaInstallContext.Provider>;
}
