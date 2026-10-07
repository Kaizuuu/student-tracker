"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import QuickAdd from "@/components/QuickAdd";

const tabs = [
  { href: "/", label: "Today", icon: "today" },
  { href: "/tasks", label: "Tasks", icon: "tasks" },
  { href: "/classes", label: "Classes", icon: "classes" },
  { href: "/more", label: "More", icon: "more" },
] as const;

function TabIcon({ name }: { name: (typeof tabs)[number]["icon"] }) {
  const shared = {
    "aria-hidden": true as const,
    className: "size-5",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
  };

  switch (name) {
    case "today":
      return <svg {...shared}><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M8 3.5v3M16 3.5v3M3.5 9.5h17M8 13h.01M12 13h.01M16 13h.01M8 16.5h.01M12 16.5h.01" /></svg>;
    case "tasks":
      return <svg {...shared}><path d="M9 6h11M9 12h11M9 18h11" /><path d="m3.5 6 .8.8L6 5M3.5 12l.8.8 1.7-1.8M3.5 18l.8.8 1.7-1.8" /></svg>;
    case "classes":
      return <svg {...shared}><path d="m3 8 9-4 9 4-9 4-9-4Z" /><path d="M6 9.5v5.2c3.7 2.8 8.3 2.8 12 0V9.5M21 8v7" /></svg>;
    case "more":
      return <svg {...shared}><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></svg>;
  }
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex min-h-11 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
            <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-sm font-bold text-accent-foreground" aria-hidden="true">S</span>
            <span className="text-sm font-semibold tracking-tight sm:text-base">Student Tracker</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-28 pt-8 sm:px-8 sm:pt-12">
        {children}
      </main>

      <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur-xl [padding-bottom:env(safe-area-inset-bottom)]">
        <div className="mx-auto grid h-[4.5rem] max-w-lg grid-cols-4 px-2 sm:max-w-2xl sm:px-6">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={`mx-1 my-1 flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${isActive ? "text-accent" : "text-muted hover:bg-background hover:text-foreground"}`}
              >
                <TabIcon name={tab.icon} />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      <QuickAdd />
    </div>
  );
}
