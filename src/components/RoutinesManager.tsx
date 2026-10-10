"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { addRecord, deleteRoutineItem, getRecords, moveRoutineItem, toggleRoutineCompletion, updateRecord } from "@/lib/db";
import { localDateKey } from "@/lib/habits";
import type { RoutineCompletionRecord, RoutineItemRecord, RoutinePeriod } from "@/types/records";

const PERIODS: { value: RoutinePeriod; title: string; description: string; placeholder: string }[] = [
  { value: "morning", title: "Morning routine", description: "Start your day with a steady rhythm.", placeholder: "e.g. Drink a glass of water" },
  { value: "night", title: "Night routine", description: "Wind down and get ready for tomorrow.", placeholder: "e.g. Pack your school bag" },
];

function displayDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export default function RoutinesManager() {
  const [items, setItems] = useState<RoutineItemRecord[]>([]);
  const [completions, setCompletions] = useState<RoutineCompletionRecord[]>([]);
  const [today, setToday] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<RoutinePeriod, string>>({ morning: "", night: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [savingPeriod, setSavingPeriod] = useState<RoutinePeriod | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [nextItems, nextCompletions] = await Promise.all([
        getRecords("routineItems"),
        getRecords("routineCompletions"),
      ]);
      setItems(nextItems.sort((a, b) => a.period.localeCompare(b.period) || a.position - b.position));
      setCompletions(nextCompletions);
      setError("");
    } catch {
      setError("Your routines could not be opened. Try refreshing the page.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setToday(localDateKey(new Date()));
    void refresh();
  }, [refresh]);

  const checkedToday = useMemo(() => {
    if (!today) return new Set<string>();
    return new Set(completions.filter((completion) => completion.date === today).map((completion) => completion.itemId));
  }, [completions, today]);

  async function addStep(event: FormEvent<HTMLFormElement>, period: RoutinePeriod) {
    event.preventDefault();
    const title = drafts[period].trim();
    if (!title || savingPeriod) return;
    setSavingPeriod(period);
    setError("");
    setNotice("");
    try {
      const position = items.filter((item) => item.period === period).reduce((max, item) => Math.max(max, item.position + 1), 0);
      await addRecord("routineItems", { period, title, position });
      setDrafts((current) => ({ ...current, [period]: "" }));
      setNotice(`“${title}” added to your ${period} routine.`);
      await refresh();
    } catch {
      setError("That routine step could not be saved. Try again.");
    } finally {
      setSavingPeriod(null);
    }
  }

  async function toggleStep(item: RoutineItemRecord) {
    if (!today || busyIds.has(item.id)) return;
    setBusyIds((current) => new Set(current).add(item.id));
    setError("");
    setNotice("");
    try {
      const checked = await toggleRoutineCompletion(item.id, today);
      setNotice(checked ? `“${item.title}” checked off.` : `“${item.title}” unchecked.`);
      await refresh();
    } catch {
      setError("That routine check-in could not be saved. Try again.");
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }
  }

  async function shiftStep(item: RoutineItemRecord, direction: -1 | 1) {
    if (busyIds.has(item.id)) return;
    setBusyIds((current) => new Set(current).add(item.id));
    setError("");
    try {
      await moveRoutineItem(item.id, direction);
      await refresh();
    } catch {
      setError("The routine order could not be changed. Try again.");
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>, item: RoutineItemRecord) {
    event.preventDefault();
    const title = editingTitle.trim();
    if (!title || busyIds.has(item.id)) return;
    setBusyIds((current) => new Set(current).add(item.id));
    setError("");
    setNotice("");
    try {
      await updateRecord("routineItems", item.id, { title });
      setEditingId(null);
      setNotice("Routine step updated.");
      await refresh();
    } catch {
      setError("That routine step could not be updated. Try again.");
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }
  }

  async function removeStep(item: RoutineItemRecord) {
    const accepted = window.confirm(`Delete “${item.title}” and its check-in history?`);
    if (!accepted || busyIds.has(item.id)) return;
    setBusyIds((current) => new Set(current).add(item.id));
    setError("");
    setNotice("");
    try {
      await deleteRoutineItem(item.id);
      setNotice(`“${item.title}” deleted from your routine.`);
      await refresh();
    } catch {
      setError("That routine step could not be deleted. Try again.");
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }
  }

  return (
    <section className="routines-page mx-auto w-full max-w-4xl">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent">Daily rhythm</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Morning &amp; night routines</h1>
      <p className="mt-3 max-w-xl text-base leading-7 text-muted">Keep your routines in the order that works for you. Check off each step as you go.</p>
      <p className="mt-2 text-sm font-medium text-muted">{today ? displayDate(today) : "Getting today’s date…"}</p>

      {error && <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-xl bg-accent/10 px-4 py-3 text-sm text-foreground">{notice}</p>}

      {loading ? <p className="mt-6 rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted">Loading your routines…</p> : <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {PERIODS.map((period) => {
          const routineItems = items.filter((item) => item.period === period.value).sort((a, b) => a.position - b.position);
          const doneCount = routineItems.filter((item) => checkedToday.has(item.id)).length;
          return <section key={period.value} aria-labelledby={`${period.value}-routine-heading`} className={`routine-card routine-${period.value} rounded-2xl border border-border bg-surface p-4 sm:p-5`}>
            <div className="flex items-start justify-between gap-3">
              <div><h2 id={`${period.value}-routine-heading`} className="text-lg font-semibold">{period.title}</h2><p className="mt-1 text-sm text-muted">{period.description}</p></div>
              <span className="shrink-0 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">{doneCount}/{routineItems.length}</span>
            </div>

            {routineItems.length > 0 ? <ol className="routine-steps mt-4 space-y-2">
              {routineItems.map((item, index) => {
                const checked = checkedToday.has(item.id);
                const busy = busyIds.has(item.id);
                return <li key={item.id} className={`rounded-xl border border-border bg-background p-3 ${busy ? "opacity-60" : ""}`}>
                  {editingId === item.id ? <form onSubmit={(event) => void saveEdit(event, item)} className="flex flex-col gap-2 sm:flex-row">
                    <label className="sr-only" htmlFor={`edit-routine-${item.id}`}>Routine step</label>
                    <input id={`edit-routine-${item.id}`} value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} maxLength={100} className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
                    <div className="flex justify-end gap-2"><button type="button" onClick={() => setEditingId(null)} className="min-h-10 rounded-lg px-3 text-sm text-muted hover:bg-surface">Cancel</button><button type="submit" disabled={!editingTitle.trim() || busy} className="min-h-10 rounded-lg bg-accent px-3 text-sm font-semibold text-accent-foreground disabled:opacity-50">Save</button></div>
                  </form> : <div className="flex items-center gap-2">
                    <button type="button" role="checkbox" aria-checked={checked} aria-label={`${checked ? "Uncheck" : "Check off"} ${item.title}`} disabled={busy || !today} onClick={() => void toggleStep(item)} className={`flex size-10 shrink-0 items-center justify-center rounded-lg border-2 text-base font-bold transition-colors ${checked ? "border-accent bg-accent text-accent-foreground" : "border-border text-transparent hover:border-accent"}`}><span aria-hidden="true">✓</span></button>
                    <span className={`min-w-0 flex-1 break-words text-sm font-medium ${checked ? "text-muted line-through" : ""}`}><span className="mr-2 text-xs tabular-nums text-muted">{index + 1}.</span>{item.title}</span>
                    <button type="button" disabled={busy || index === 0} onClick={() => void shiftStep(item, -1)} aria-label={`Move ${item.title} up`} className="min-h-9 min-w-9 rounded-lg text-lg text-muted hover:bg-surface disabled:opacity-30">↑</button>
                    <button type="button" disabled={busy || index === routineItems.length - 1} onClick={() => void shiftStep(item, 1)} aria-label={`Move ${item.title} down`} className="min-h-9 min-w-9 rounded-lg text-lg text-muted hover:bg-surface disabled:opacity-30">↓</button>
                    <button type="button" disabled={busy} onClick={() => { setEditingId(item.id); setEditingTitle(item.title); }} aria-label={`Edit ${item.title}`} className="min-h-9 rounded-lg px-2 text-xs font-medium text-muted hover:bg-surface disabled:opacity-50">Edit</button>
                    <button type="button" disabled={busy} onClick={() => void removeStep(item)} aria-label={`Delete ${item.title}`} className="min-h-9 rounded-lg px-2 text-xs font-medium text-muted hover:bg-surface hover:text-red-700 disabled:opacity-50 dark:hover:text-red-300">Delete</button>
                  </div>}
                </li>;
              })}
            </ol> : <p className="mt-4 rounded-xl border border-dashed border-border px-3 py-5 text-center text-sm text-muted">Add your first step below.</p>}

            <form onSubmit={(event) => void addStep(event, period.value)} className="mt-4 border-t border-border pt-4">
              <label htmlFor={`${period.value}-routine-new-item`} className="text-sm font-semibold">Add a step</label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input id={`${period.value}-routine-new-item`} value={drafts[period.value]} onChange={(event) => setDrafts((current) => ({ ...current, [period.value]: event.target.value }))} maxLength={100} placeholder={period.placeholder} className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20" />
                <button type="submit" disabled={!drafts[period.value].trim() || savingPeriod !== null} className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50">{savingPeriod === period.value ? "Adding…" : "Add step"}</button>
              </div>
            </form>
          </section>;
        })}
      </div>}
    </section>
  );
}
