"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getRecords, toggleHabitCompletion, toggleRoutineCompletion } from "@/lib/db";
import { getForgivingStreak, localDateKey } from "@/lib/habits";
import type {
  HabitCompletionRecord,
  HabitCompletionVersion,
  HabitRecord,
  RoutineCompletionRecord,
  RoutineItemRecord,
  RoutinePeriod,
} from "@/types/records";

const PREVIEW_HABIT_COUNT = 3;
const PREVIEW_ROUTINE_COUNT = 4;

const periods: { value: RoutinePeriod; label: string }[] = [
  { value: "morning", label: "Morning" },
  { value: "night", label: "Night" },
];

export default function TodayRhythm() {
  const [habits, setHabits] = useState<HabitRecord[]>([]);
  const [habitCompletions, setHabitCompletions] = useState<HabitCompletionRecord[]>([]);
  const [routineItems, setRoutineItems] = useState<RoutineItemRecord[]>([]);
  const [routineCompletions, setRoutineCompletions] = useState<RoutineCompletionRecord[]>([]);
  const [today, setToday] = useState<string | null>(null);
  const [activePeriod, setActivePeriod] = useState<RoutinePeriod>("morning");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [nextHabits, nextHabitCompletions, nextRoutineItems, nextRoutineCompletions] = await Promise.all([
        getRecords("habits"),
        getRecords("habitCompletions"),
        getRecords("routineItems"),
        getRecords("routineCompletions"),
      ]);
      setHabits(nextHabits.sort((left, right) => left.createdAt.localeCompare(right.createdAt)));
      setHabitCompletions(nextHabitCompletions);
      setRoutineItems(nextRoutineItems.sort((left, right) => left.period.localeCompare(right.period) || left.position - right.position));
      setRoutineCompletions(nextRoutineCompletions);
      setError("");
    } catch {
      setError("Your habits and routines could not be opened. Try refreshing the page.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const now = new Date();
    setToday(localDateKey(now));
    setActivePeriod(now.getHours() < 12 ? "morning" : "night");
    void refresh();
  }, [refresh]);

  const todaysHabitCompletions = useMemo(
    () => habitCompletions.filter((completion) => completion.date === today),
    [habitCompletions, today],
  );
  const habitVersionById = useMemo(
    () => new Map(todaysHabitCompletions.map((completion) => [completion.habitId, completion.version ?? "full"])),
    [todaysHabitCompletions],
  );
  const habitDatesById = useMemo(() => {
    const byHabit = new Map<string, string[]>();
    for (const completion of habitCompletions) {
      const dates = byHabit.get(completion.habitId) ?? [];
      dates.push(completion.date);
      byHabit.set(completion.habitId, dates);
    }
    return byHabit;
  }, [habitCompletions]);

  const todaysRoutineCompletions = useMemo(
    () => new Set(routineCompletions.filter((completion) => completion.date === today).map((completion) => completion.itemId)),
    [routineCompletions, today],
  );
  const activeRoutineItems = useMemo(
    () => routineItems.filter((item) => item.period === activePeriod),
    [activePeriod, routineItems],
  );
  const completedRoutineCount = activeRoutineItems.filter((item) => todaysRoutineCompletions.has(item.id)).length;
  const completedHabitCount = todaysHabitCompletions.length;

  async function checkHabit(habit: HabitRecord, version: HabitCompletionVersion) {
    if (!today || busyId) return;
    setBusyId(habit.id);
    setError("");
    try {
      await toggleHabitCompletion(habit.id, today, version);
      await refresh();
    } catch {
      setError(`“${habit.title}” could not be checked off. Try again.`);
    } finally {
      setBusyId(null);
    }
  }

  async function checkRoutine(item: RoutineItemRecord) {
    if (!today || busyId) return;
    setBusyId(item.id);
    setError("");
    try {
      await toggleRoutineCompletion(item.id, today);
      await refresh();
    } catch {
      setError(`“${item.title}” could not be checked off. Try again.`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section aria-labelledby="today-rhythm-heading" className="today-rhythm rounded-3xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Small steps add up</p>
          <h2 id="today-rhythm-heading" className="mt-1 text-lg font-semibold">Daily rhythm</h2>
        </div>
        <div className="flex gap-3 pt-1 text-sm font-semibold">
          <Link href="/habits" className="text-accent hover:underline">Habits</Link>
          <Link href="/routines" className="text-accent hover:underline">Routines</Link>
        </div>
      </div>

      {error && <p role="alert" className="mt-3 rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p>}

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <section aria-labelledby="today-habits-heading" className="rounded-2xl border border-border bg-background p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 id="today-habits-heading" className="text-sm font-semibold">Habits</h3>
            <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-muted">{completedHabitCount}/{habits.length}</span>
          </div>
          {habits.length > 0 && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface" role="progressbar" aria-label="Habits completed today" aria-valuemin={0} aria-valuemax={habits.length} aria-valuenow={completedHabitCount}>
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${(completedHabitCount / habits.length) * 100}%` }} />
          </div>}

          {loading ? <p className="mt-3 text-sm text-muted">Loading habits…</p> : habits.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-border bg-surface px-3 py-4 text-center">
              <p className="text-sm text-muted">No habits set up yet.</p>
              <Link href="/habits" className="mt-2 inline-flex min-h-9 items-center rounded-full bg-accent/10 px-3 text-sm font-semibold text-accent">Create a habit</Link>
            </div>
          ) : <ul className="mt-2 divide-y divide-border">
            {habits.slice(0, PREVIEW_HABIT_COUNT).map((habit) => {
              const completedVersion = habitVersionById.get(habit.id);
              const streak = today ? getForgivingStreak(habitDatesById.get(habit.id) ?? [], today) : 0;
              const busy = busyId === habit.id;
              return <li key={habit.id} className="flex items-center gap-2 py-2.5 first:pt-1 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className={`break-words text-sm font-medium ${completedVersion ? "text-muted line-through" : ""}`}>{habit.title}</p>
                  {streak > 0 && <p className="mt-0.5 text-[11px] font-medium text-accent">{streak}-day streak</p>}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button type="button" disabled={!today || busyId !== null} aria-pressed={completedVersion === "full"} onClick={() => void checkHabit(habit, "full")} className={`min-h-9 min-w-11 rounded-xl border px-2 text-xs font-semibold ${completedVersion === "full" ? "border-accent bg-accent text-accent-foreground" : "border-border bg-surface text-foreground hover:border-accent"}`} aria-label={`${completedVersion === "full" ? "Uncheck" : "Check off"} ${habit.title}`}>
                    {completedVersion === "full" ? "✓" : "Full"}
                  </button>
                  {habit.smallVersion && <button type="button" disabled={!today || busyId !== null} aria-pressed={completedVersion === "small"} onClick={() => void checkHabit(habit, "small")} className={`min-h-9 max-w-24 break-words rounded-xl border px-2 text-xs font-semibold leading-tight ${completedVersion === "small" ? "border-accent bg-accent text-accent-foreground" : "border-border bg-surface text-foreground hover:border-accent"}`} aria-label={`${completedVersion === "small" ? "Uncheck" : "Check off"} ${habit.title}: ${habit.smallVersion}`}>
                    {completedVersion === "small" ? "✓" : habit.smallVersion}
                  </button>}
                </div>
              </li>;
            })}
          </ul>}
          {habits.length > PREVIEW_HABIT_COUNT && <Link href="/habits" className="mt-3 inline-flex min-h-9 items-center text-xs font-semibold text-accent hover:underline">See all {habits.length} habits <span aria-hidden="true" className="ml-1">→</span></Link>}
        </section>

        <section aria-labelledby="today-routines-heading" className="rounded-2xl border border-border bg-background p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 id="today-routines-heading" className="text-sm font-semibold">Routines</h3>
            <div className="flex rounded-full bg-surface p-1" aria-label="Routine period">
              {periods.map((period) => <button key={period.value} type="button" aria-pressed={activePeriod === period.value} onClick={() => setActivePeriod(period.value)} className={`min-h-8 rounded-full px-3 text-xs font-semibold ${activePeriod === period.value ? "bg-accent text-accent-foreground shadow-sm" : "text-muted hover:text-foreground"}`}>{period.label}</button>)}
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">{loading ? "Loading routines…" : `${completedRoutineCount} of ${activeRoutineItems.length} steps complete`}</p>

          {loading ? <div className="mt-3 h-12 animate-pulse rounded-xl bg-surface" /> : activeRoutineItems.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-border bg-surface px-3 py-4 text-center">
              <p className="text-sm text-muted">No {activePeriod} steps yet.</p>
              <Link href="/routines" className="mt-2 inline-flex min-h-9 items-center rounded-full bg-accent/10 px-3 text-sm font-semibold text-accent">Set up a routine</Link>
            </div>
          ) : <ul className="mt-2 divide-y divide-border">
            {activeRoutineItems.slice(0, PREVIEW_ROUTINE_COUNT).map((item, index) => {
              const checked = todaysRoutineCompletions.has(item.id);
              return <li key={item.id} className="flex items-center gap-3 py-2 first:pt-1 last:pb-0">
                <button type="button" role="checkbox" aria-checked={checked} aria-label={`${checked ? "Uncheck" : "Check off"} ${item.title}`} disabled={!today || busyId !== null} onClick={() => void checkRoutine(item)} className={`flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold transition-colors ${checked ? "border-accent bg-accent text-accent-foreground" : "border-border bg-surface text-transparent hover:border-accent"}`}><span aria-hidden="true">✓</span></button>
                <span className={`min-w-0 flex-1 break-words text-sm ${checked ? "text-muted line-through" : "font-medium"}`}><span className="mr-2 text-xs tabular-nums text-muted">{index + 1}.</span>{item.title}</span>
              </li>;
            })}
          </ul>}
          {activeRoutineItems.length > PREVIEW_ROUTINE_COUNT && <Link href="/routines" className="mt-3 inline-flex min-h-9 items-center text-xs font-semibold text-accent hover:underline">See all {activeRoutineItems.length} steps <span aria-hidden="true" className="ml-1">→</span></Link>}
        </section>
      </div>
    </section>
  );
}
