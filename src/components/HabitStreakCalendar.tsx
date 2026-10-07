"use client";

import { useEffect, useMemo, useState } from "react";
import { localDateKey } from "@/lib/habits";
import type { HabitCompletionRecord, HabitRecord } from "@/types/records";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function mondayOf(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

function heatClasses(count: number, total: number) {
  if (!count || !total) return "border-border bg-background text-muted";
  const ratio = count / total;
  if (ratio <= 0.25) return "border-accent/20 bg-accent/10 text-foreground";
  if (ratio <= 0.5) return "border-accent/30 bg-accent/25 text-foreground";
  if (ratio <= 0.75) return "border-accent/50 bg-accent/45 text-foreground";
  return "border-accent bg-accent text-accent-foreground";
}

export default function HabitStreakCalendar({
  habits,
  completions,
  today,
}: {
  habits: HabitRecord[];
  completions: HabitCompletionRecord[];
  today: string | null;
}) {
  const [month, setMonth] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    if (!today) return;
    const current = new Date(`${today}T12:00:00`);
    setMonth(new Date(current.getFullYear(), current.getMonth(), 1));
    setSelectedDate(today);
  }, [today]);

  const completionsByDate = useMemo(() => {
    const grouped = new Map<string, Set<string>>();
    for (const completion of completions) {
      const habitIds = grouped.get(completion.date) ?? new Set<string>();
      habitIds.add(completion.habitId);
      grouped.set(completion.date, habitIds);
    }
    return grouped;
  }, [completions]);

  const calendarDays = useMemo(() => {
    if (!month) return [];
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = mondayOf(first);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(date.getDate() + index);
      return date;
    });
  }, [month]);

  const inMonthDates = useMemo(() => calendarDays.filter((date) => month && date.getMonth() === month.getMonth()), [calendarDays, month]);
  const activeDays = inMonthDates.filter((date) => (completionsByDate.get(localDateKey(date))?.size ?? 0) > 0).length;
  const selectedCompletions = selectedDate ? completionsByDate.get(selectedDate) ?? new Set<string>() : new Set<string>();
  const habitNamesById = useMemo(() => new Map(habits.map((habit) => [habit.id, habit.title])), [habits]);
  const selectedNames = [...selectedCompletions].map((id) => habitNamesById.get(id)).filter((name): name is string => Boolean(name));

  function changeMonth(direction: number) {
    if (!month) return;
    const next = new Date(month.getFullYear(), month.getMonth() + direction, 1);
    setMonth(next);
    setSelectedDate(localDateKey(next));
  }

  return (
    <section aria-labelledby="habit-streak-calendar-heading" className="mt-8 rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Your progress</p>
          <h2 id="habit-streak-calendar-heading" className="mt-1 text-lg font-semibold">Streak calendar</h2>
          <p className="mt-1 text-sm text-muted">Darker days mean more habits checked off.</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-background p-1">
          <button type="button" onClick={() => changeMonth(-1)} disabled={!month} aria-label="Previous month" className="min-h-10 min-w-10 rounded-lg text-lg text-muted hover:bg-surface disabled:opacity-40">‹</button>
          <p className="min-w-28 px-2 text-center text-sm font-semibold">{month?.toLocaleDateString(undefined, { month: "long", year: "numeric" }) ?? "Loading…"}</p>
          <button type="button" onClick={() => changeMonth(1)} disabled={!month} aria-label="Next month" className="min-h-10 min-w-10 rounded-lg text-lg text-muted hover:bg-surface disabled:opacity-40">›</button>
        </div>
      </div>

      {habits.length === 0 ? <p className="mt-5 rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted">Add a habit to start building your calendar.</p> : <>
        <p className="mt-4 text-sm text-muted">{activeDays} of {inMonthDates.length} days had a check-in</p>
        <div role="grid" aria-label={`Habit completion calendar for ${month?.toLocaleDateString(undefined, { month: "long", year: "numeric" }) ?? "selected month"}`} className="mt-3">
          <div role="row" className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((weekday) => <div key={weekday} role="columnheader" className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted sm:text-xs">{weekday}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {calendarDays.map((date) => {
              const dateKey = localDateKey(date);
              const currentMonth = month !== null && date.getMonth() === month.getMonth();
              const count = completionsByDate.get(dateKey)?.size ?? 0;
              const isToday = dateKey === today;
              const isSelected = dateKey === selectedDate;
              if (!currentMonth) return <div key={dateKey} aria-hidden="true" className="min-h-10 rounded-lg border border-transparent sm:min-h-11" />;
              const label = `${date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}: ${count} of ${habits.length} ${habits.length === 1 ? "habit" : "habits"} completed`;
              return <button key={dateKey} type="button" role="gridcell" aria-label={label} aria-pressed={isSelected} title={label} onClick={() => setSelectedDate(dateKey)} className={`flex min-h-10 flex-col items-center justify-center rounded-lg border text-xs transition-colors sm:min-h-11 ${heatClasses(count, habits.length)} ${isToday ? "ring-1 ring-accent ring-offset-1 ring-offset-surface" : ""} ${isSelected ? "outline outline-2 outline-accent outline-offset-1" : ""}`}>
                <span className="font-semibold tabular-nums">{date.getDate()}</span>
                <span className="text-[9px] leading-3 tabular-nums">{count > 0 ? count : " "}</span>
              </button>;
            })}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <p className="text-sm font-medium">{selectedDate ? new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "Select a day"}: {selectedCompletions.size}/{habits.length} complete</p>
          <div className="flex items-center gap-1.5 text-xs text-muted" aria-label="Heat map scale, less to more">
            <span>Less</span><i className={`size-3 rounded border ${heatClasses(0, habits.length)}`} /><i className={`size-3 rounded border ${heatClasses(1, habits.length)}`} /><i className={`size-3 rounded border ${heatClasses(2, habits.length)}`} /><i className={`size-3 rounded border ${heatClasses(habits.length, habits.length)}`} /><span>More</span>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">{selectedNames.length ? `Completed: ${selectedNames.join(", ")}` : "No habit check-ins on this day."}</p>
      </>}
    </section>
  );
}
