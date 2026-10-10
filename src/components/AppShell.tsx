"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import QuickAdd from "@/components/QuickAdd";
import PwaInstallProvider from "@/components/PwaInstallProvider";
import ReminderCenter from "@/components/ReminderCenter";

const tabs = [
  { href: "/", label: "Today", icon: "today" },
  { href: "/tasks", label: "Tasks", icon: "tasks" },
  { href: "/classes", label: "Courses", icon: "classes" },
  { href: "/more", label: "More", icon: "more" },
] as const;

const desktopLinks = [
  { href: "/week", label: "Weekly calendar", icon: "calendar" },
  { href: "/calendar", label: "Exams & events", icon: "events" },
  { href: "/focus", label: "Focus timer", icon: "focus" },
  { href: "/habits", label: "Daily habits", icon: "habits" },
  { href: "/routines", label: "Routines", icon: "routines" },
  { href: "/review", label: "Weekly review", icon: "review" },
  { href: "/design", label: "Design direction", icon: "review" },
] as const;

type NavigationIcon = (typeof tabs)[number]["icon"] | (typeof desktopLinks)[number]["icon"];

function TabIcon({ name }: { name: NavigationIcon }) {
  const shared = {
    "aria-hidden": true as const,
    className: "size-[1.35rem]",
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
    case "calendar":
      return <svg {...shared}><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M8 3.5v3M16 3.5v3M3.5 9.5h17M8 13h.01M12 13h.01M16 13h.01M8 16.5h.01M12 16.5h.01" /></svg>;
    case "events":
      return <svg {...shared}><path d="M7 3.5v3M17 3.5v3M4 9h16M5.5 5h13A1.5 1.5 0 0 1 20 6.5v12A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-12A1.5 1.5 0 0 1 5.5 5Z" /><path d="M8 13h3M8 16h6" /></svg>;
    case "focus":
      return <svg {...shared}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2M12 2v2M22 12h-2" /></svg>;
    case "habits":
      return <svg {...shared}><path d="m5 12.5 4.2 4.2L19.5 6.8" /></svg>;
    case "routines":
      return <svg {...shared}><path d="M5 6h14M5 12h14M5 18h14" /><circle cx="3" cy="6" r=".5" /><circle cx="3" cy="12" r=".5" /><circle cx="3" cy="18" r=".5" /></svg>;
    case "review":
      return <svg {...shared}><path d="M4 19V5M4 19h16M7 15l4-4 3 2 5-6" /><path d="M16 7h3v3" /></svg>;
  }
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const renderTab = (tab: (typeof tabs)[number]) => {
    const isActive = pathname === tab.href;
    return (
      <Link
        key={tab.href}
        href={tab.href}
        aria-current={isActive ? "page" : undefined}
        aria-label={tab.label}
        title={tab.label}
        className={`app-nav-link mx-1 my-1 flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${isActive ? "text-accent" : "text-muted hover:bg-background/70 hover:text-foreground"}`}
      >
        <TabIcon name={tab.icon} />
      <span className={`app-nav-label text-[10px] font-medium leading-none tracking-tight ${isActive ? "font-semibold" : ""}`}>{tab.label}</span>
      </Link>
    );
  };

  const renderDesktopLink = (link: (typeof desktopLinks)[number]) => {
    const isActive = pathname === link.href;
    return <Link key={link.href} href={link.href} aria-current={isActive ? "page" : undefined} className={`app-nav-link app-nav-secondary-link flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${isActive ? "text-accent" : "text-muted hover:bg-background/75 hover:text-foreground"}`}><TabIcon name={link.icon} /><span className="app-nav-label">{link.label}</span></Link>;
  };

  return (
    <PwaInstallProvider>
    <div className="app-shell flex min-h-dvh flex-col">
      <header className="app-header sticky top-0 z-20 border-b border-border/70 bg-background/75 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/60">
        <div className="app-header-inner mx-auto flex h-[4.25rem] w-full max-w-5xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="group flex min-h-11 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
            <Image src="/student-tracker-logo.png" alt="" width={36} height={36} priority className="size-9 shrink-0 object-contain transition-transform group-hover:scale-105" aria-hidden="true" />
            <span className="text-[15px] font-semibold tracking-tight sm:text-base">Student Tracker</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="app-main mx-auto min-w-0 w-full max-w-5xl flex-1 px-5 pb-32 pt-8 sm:px-8 sm:pb-36 sm:pt-12">
        <div key={pathname} className="app-page-enter">
          {children}
        </div>
      </main>

      <nav aria-label="Main navigation" className="app-navigation fixed inset-x-0 bottom-0 z-30 px-4 pb-[calc(env(safe-area-inset-bottom)+0.8rem)]">
        <div className="app-navigation-inner mx-auto grid h-[4.65rem] w-full max-w-lg grid-cols-5 items-center rounded-[1.65rem] border border-white/70 bg-surface/85 px-2 shadow-[0_12px_44px_rgba(35,89,127,0.17)] backdrop-blur-2xl dark:border-white/10 sm:px-4">
          {tabs.slice(0, 2).map(renderTab)}
          <QuickAdd />
          {tabs.slice(2).map(renderTab)}
          <div className="app-navigation-extras" aria-label="More planner pages">
            <p className="app-navigation-heading">Plan &amp; reflect</p>
            {desktopLinks.map(renderDesktopLink)}
          </div>
        </div>
      </nav>
      <ReminderCenter />
    </div>
    </PwaInstallProvider>
  );
}
