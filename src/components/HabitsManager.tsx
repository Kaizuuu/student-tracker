"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { addRecord, deleteHabit, getRecords, toggleHabitCompletion, updateRecord } from "@/lib/db";
import { getForgivingStreak, localDateKey } from "@/lib/habits";
import HabitStreakCalendar from "@/components/HabitStreakCalendar";
import type { HabitCompletionRecord, HabitCompletionVersion, HabitRecord } from "@/types/records";

function displayDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function HabitsManager() {
  const [habits, setHabits] = useState<HabitRecord[]>([]);
  const [completions, setCompletions] = useState<HabitCompletionRecord[]>([]);
  const [today, setToday] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [smallVersion, setSmallVersion] = useState("");
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSmallVersion, setEditSmallVersion] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyHabitIds, setBusyHabitIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [nextHabits, nextCompletions] = await Promise.all([
        getRecords("habits"),
        getRecords("habitCompletions"),
      ]);
      setHabits(nextHabits.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      setCompletions(nextCompletions);
      setError("");
    } catch {
      setError("Your habits could not be opened. Try refreshing the page.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setToday(localDateKey(new Date()));
    void refresh();
  }, [refresh]);

  const completionsByHabit = useMemo(() => {
    const grouped = new Map<string, string[]>();
    for (const completion of completions) {
      const dates = grouped.get(completion.habitId) ?? [];
      dates.push(completion.date);
      grouped.set(completion.habitId, dates);
    }
    return grouped;
  }, [completions]);

  const completedToday = useMemo(() => {
    if (!today) return new Set<string>();
    return new Set(completions.filter((completion) => completion.date === today).map((completion) => completion.habitId));
  }, [completions, today]);
  const todayCompletionByHabit = useMemo(() => new Map(
    completions.filter((completion) => completion.date === today).map((completion) => [completion.habitId, completion.version ?? "full"]),
  ), [completions, today]);

  async function createHabit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await addRecord("habits", { title: cleanTitle, smallVersion: smallVersion.trim() || null });
      setTitle("");
      setSmallVersion("");
      setNotice(`“${cleanTitle}” added to your daily habits.`);
      await refresh();
    } catch {
      setError("That habit could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleToday(habit: HabitRecord, version: HabitCompletionVersion) {
    if (!today || busyHabitIds.has(habit.id)) return;
    setBusyHabitIds((current) => new Set(current).add(habit.id));
    setError("");
    setNotice("");
    try {
      const result = await toggleHabitCompletion(habit.id, today, version);
      setNotice(result === "unchecked"
        ? `“${habit.title}” unchecked for today.`
        : result === "changed"
          ? `“${habit.title}” check-in changed to its ${version === "small" ? "small" : "full"} version.`
          : `“${habit.title}” checked off for today.`);
      await refresh();
    } catch {
      setError("That check-in could not be saved. Try again.");
    } finally {
      setBusyHabitIds((current) => {
        const next = new Set(current);
        next.delete(habit.id);
        return next;
      });
    }
  }

  async function saveHabitEdit(event: FormEvent<HTMLFormElement>, habitId: string) {
    event.preventDefault();
    const cleanTitle = editTitle.trim();
    if (!cleanTitle || busyHabitIds.has(habitId)) return;
    setBusyHabitIds((current) => new Set(current).add(habitId));
    setError("");
    setNotice("");
    try {
      await updateRecord("habits", habitId, { title: cleanTitle, smallVersion: editSmallVersion.trim() || null });
      setEditingHabitId(null);
      setNotice(`“${cleanTitle}” updated.`);
      await refresh();
    } catch {
      setError("That habit could not be updated. Try again.");
    } finally {
      setBusyHabitIds((current) => {
        const next = new Set(current);
        next.delete(habitId);
        return next;
      });
    }
  }

  async function removeHabit(habit: HabitRecord) {
    const accepted = window.confirm(`Delete “${habit.title}” and its check-in history?`);
    if (!accepted) return;
    setBusyHabitIds((current) => new Set(current).add(habit.id));
    setError("");
    setNotice("");
    try {
      await deleteHabit(habit.id);
      setNotice(`“${habit.title}” and its check-in history were deleted.`);
      await refresh();
    } catch {
      setError("That habit could not be deleted. Try again.");
    } finally {
      setBusyHabitIds((current) => {
        const next = new Set(current);
        next.delete(habit.id);
        return next;
      });
    }
  }

  const todayCount = completedToday.size;

  return (
    <section className="habits-page mx-auto w-full max-w-2xl">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent">Build a steady rhythm</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Daily habits</h1>
      <p className="mt-3 max-w-lg text-base leading-7 text-muted">Check off the small routines you want to keep. One missed day won’t break your streak.</p>

      <div className="habit-progress mt-6 rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-sm font-semibold">Today</p><p className="mt-1 text-sm text-muted">{today ? displayDate(today) : "Getting today’s date…"}</p></div>
          <p className="rounded-full bg-accent/10 px-3 py-1.5 text-sm font-semibold text-accent">{todayCount} / {habits.length} done</p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-background" role="progressbar" aria-label="Habits completed today" aria-valuemin={0} aria-valuemax={habits.length || 1} aria-valuenow={todayCount}>
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${habits.length ? Math.min(100, (todayCount / habits.length) * 100) : 0}%` }} />
        </div>
      </div>

      <form onSubmit={(event) => void createHabit(event)} className="mt-5 rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <label htmlFor="new-habit-title" className="text-sm font-semibold">Add a daily habit</label>
        <input id="new-habit-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} placeholder="e.g. Read for 10 minutes" className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20" />
        <label htmlFor="new-habit-small-version" className="mt-3 block text-sm font-medium">Small version <span className="font-normal text-muted">(optional)</span></label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input id="new-habit-small-version" value={smallVersion} onChange={(event) => setSmallVersion(event.target.value)} maxLength={80} placeholder="e.g. Read 1 page" className="min-h-12 min-w-0 flex-1 rounded-xl border border-border bg-background px-4 text-base outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20" />
          <button type="submit" disabled={!title.trim() || saving} className="min-h-12 rounded-xl bg-accent px-5 font-semibold text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Adding…" : "Add habit"}</button>
        </div>
      </form>

      {error && <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-xl bg-accent/10 px-4 py-3 text-sm text-foreground">{notice}</p>}

      <div className="mt-6 space-y-3">
        {loading ? <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">Loading your habits…</p> : habits.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface px-5 py-8 text-center">
            <p className="font-semibold">Start with one habit</p>
            <p className="mt-1 text-sm text-muted">Choose something small enough to repeat most days.</p>
          </div>
        ) : habits.map((habit) => {
          const dates = completionsByHabit.get(habit.id) ?? [];
          const streak = today ? getForgivingStreak(dates, today) : 0;
          const checked = completedToday.has(habit.id);
          const checkedVersion = todayCompletionByHabit.get(habit.id);
          const busy = busyHabitIds.has(habit.id);
          if (editingHabitId === habit.id) return <article key={habit.id} className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
            <form onSubmit={(event) => void saveHabitEdit(event, habit.id)}>
              <h2 className="font-semibold">Edit habit</h2>
              <label htmlFor={`edit-habit-title-${habit.id}`} className="mt-3 block text-sm font-medium">Habit</label>
              <input id={`edit-habit-title-${habit.id}`} value={editTitle} onChange={(event) => setEditTitle(event.target.value)} maxLength={80} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
              <label htmlFor={`edit-habit-small-${habit.id}`} className="mt-3 block text-sm font-medium">Small version <span className="font-normal text-muted">(optional)</span></label>
              <input id={`edit-habit-small-${habit.id}`} value={editSmallVersion} onChange={(event) => setEditSmallVersion(event.target.value)} maxLength={80} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
              <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setEditingHabitId(null)} className="min-h-10 rounded-xl px-4 text-sm font-medium text-muted hover:bg-background">Cancel</button><button type="submit" disabled={!editTitle.trim() || busy} className="min-h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground disabled:opacity-50">Save</button></div>
            </form>
          </article>;
          return <article key={habit.id} className={`habit-card rounded-2xl border border-border bg-surface p-4 transition-opacity sm:p-5 ${busy ? "opacity-70" : ""}`}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h2 className={`break-words text-base font-semibold ${checked ? "text-muted line-through" : ""}`}>{habit.title}</h2>
                <p className="mt-1 text-sm text-muted">{streak > 0 ? <><span className="font-semibold text-accent">{streak}-day streak</span><span> · one day off is okay</span></> : "Check in to start your streak"}</p>
                {checkedVersion && <p className="mt-1 text-xs font-medium text-accent">Checked in: {checkedVersion === "small" ? "Small version" : "Full version"}</p>}
                {dates.length > 0 && <p className="mt-1 text-xs text-muted">{dates.length} {dates.length === 1 ? "check-in" : "check-ins"} total</p>}
              </div>
              <div className="flex shrink-0 gap-1"><button type="button" disabled={busy} onClick={() => { setEditingHabitId(habit.id); setEditTitle(habit.title); setEditSmallVersion(habit.smallVersion ?? ""); }} className="min-h-10 rounded-lg px-2 text-sm font-medium text-muted hover:bg-background disabled:opacity-50">Edit</button><button type="button" disabled={busy} onClick={() => void removeHabit(habit)} className="min-h-10 rounded-lg px-2 text-sm font-medium text-muted hover:bg-background hover:text-red-700 disabled:opacity-50 dark:hover:text-red-300" aria-label={`Delete ${habit.title}`}>Delete</button></div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" disabled={busy || !today} aria-pressed={checkedVersion === "full"} onClick={() => void toggleToday(habit, "full")} className={`min-h-11 rounded-xl border px-3 text-sm font-semibold transition-colors ${checkedVersion === "full" ? "border-accent bg-accent text-accent-foreground" : "border-border bg-background hover:border-accent"}`}>Full version</button>
              {habit.smallVersion && <button type="button" disabled={busy || !today} aria-pressed={checkedVersion === "small"} onClick={() => void toggleToday(habit, "small")} className={`min-h-11 rounded-xl border px-3 text-sm font-semibold transition-colors ${checkedVersion === "small" ? "border-accent bg-accent text-accent-foreground" : "border-border bg-background hover:border-accent"}`}>{habit.smallVersion}</button>}
            </div>
          </article>;
        })}
      </div>
      <HabitStreakCalendar habits={habits} completions={completions} today={today} />
    </section>
  );
}
