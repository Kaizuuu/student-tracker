import Link from "next/link";
import BackupManager from "@/components/BackupManager";

export default function MorePage() {
  return (
    <section className="mx-auto w-full max-w-2xl">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Your planner</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">More</h1>
      <p className="mt-3 max-w-lg text-base leading-7 text-muted">Manage the building blocks that keep your planner organized.</p>

      <Link
        href="/focus"
        className="mt-8 flex min-h-20 items-center gap-4 rounded-2xl border border-border bg-surface p-5 transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-lg text-accent" aria-hidden="true">◴</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Focus timer</span>
          <span className="mt-1 block text-sm text-muted">Pomodoro blocks with study time by subject</span>
        </span>
        <span className="text-xl text-muted" aria-hidden="true">›</span>
      </Link>

      <Link
        href="/week"
        className="mt-3 flex min-h-20 items-center gap-4 rounded-2xl border border-border bg-surface p-5 transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-lg text-accent" aria-hidden="true">▦</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Weekly calendar</span>
          <span className="mt-1 block text-sm text-muted">Classes, tasks, exams, and events together</span>
        </span>
        <span className="text-xl text-muted" aria-hidden="true">›</span>
      </Link>

      <Link
        href="/habits"
        className="mt-3 flex min-h-20 items-center gap-4 rounded-2xl border border-border bg-surface p-5 transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-lg text-accent" aria-hidden="true">✓</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Daily habits</span>
          <span className="mt-1 block text-sm text-muted">Check in and build forgiving streaks</span>
        </span>
        <span className="text-xl text-muted" aria-hidden="true">›</span>
      </Link>

      <Link
        href="/routines"
        className="mt-3 flex min-h-20 items-center gap-4 rounded-2xl border border-border bg-surface p-5 transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-lg text-accent" aria-hidden="true">☼</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Morning &amp; night routines</span>
          <span className="mt-1 block text-sm text-muted">Ordered steps for your daily rhythm</span>
        </span>
        <span className="text-xl text-muted" aria-hidden="true">›</span>
      </Link>

      <Link
        href="/review"
        className="mt-3 flex min-h-20 items-center gap-4 rounded-2xl border border-border bg-surface p-5 transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-lg text-accent" aria-hidden="true">↗</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Weekly review</span>
          <span className="mt-1 block text-sm text-muted">Reflect on this week and plan the next</span>
        </span>
        <span className="text-xl text-muted" aria-hidden="true">›</span>
      </Link>

      <Link
        href="/subjects"
        className="mt-3 flex min-h-20 items-center gap-4 rounded-2xl border border-border bg-surface p-5 transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-lg text-accent" aria-hidden="true">◉</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Subjects</span>
          <span className="mt-1 block text-sm text-muted">Names, colors, and linked planner items</span>
        </span>
        <span className="text-xl text-muted" aria-hidden="true">›</span>
      </Link>

      <Link
        href="/calendar"
        className="mt-3 flex min-h-20 items-center gap-4 rounded-2xl border border-border bg-surface p-5 transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-lg text-accent" aria-hidden="true">◷</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Exams &amp; events</span>
          <span className="mt-1 block text-sm text-muted">Important dates and countdowns</span>
        </span>
        <span className="text-xl text-muted" aria-hidden="true">›</span>
      </Link>

      <BackupManager />
    </section>
  );
}
