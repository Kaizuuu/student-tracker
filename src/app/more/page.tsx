import Link from "next/link";
import BackupManager from "@/components/BackupManager";

export default function MorePage() {
  return (
    <section className="mx-auto w-full max-w-2xl">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Your planner</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">More</h1>
      <p className="mt-3 max-w-lg text-base leading-7 text-muted">Manage the building blocks that keep your planner organized.</p>

      <Link
        href="/subjects"
        className="mt-8 flex min-h-20 items-center gap-4 rounded-2xl border border-border bg-surface p-5 transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
