"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getRecords } from "@/lib/db";
import { localDateKey } from "@/lib/habits";
import type { CalendarEntryRecord, ClassRecord, HabitCompletionRecord, HabitRecord, RoutineCompletionRecord, RoutineItemRecord, SubjectRecord, TaskRecord } from "@/types/records";

type LoadItem = {
  id: string;
  kind: "class" | "task" | "exam" | "event";
  title: string;
  at: Date;
  detail?: string;
};

function mondayOf(date: Date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

function addDays(date: Date, count: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

function classTimeOn(date: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours || 0, minutes || 0);
}

function clock(date: Date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function kindLabel(kind: LoadItem["kind"]) {
  return kind === "class" ? "Class" : kind === "task" ? "Task" : kind === "exam" ? "Exam" : "Event";
}

function weekLabel(start: Date, end: Date) {
  const startLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${startLabel} – ${endLabel}`;
}

function toLoadItems(date: Date, classes: ClassRecord[], tasks: TaskRecord[], entries: CalendarEntryRecord[], subjects: Map<string, SubjectRecord>): LoadItem[] {
  const dayKey = localDateKey(date);
  const items: LoadItem[] = [];
  for (const item of classes) {
    if (item.dayOfWeek !== date.getDay()) continue;
    const subject = subjects.get(item.subjectId ?? "");
    items.push({
      id: `class-${item.id}`,
      kind: "class",
      title: subject?.name ?? "Class",
      at: classTimeOn(date, item.startTime),
      detail: [item.startTime, item.endTime].filter(Boolean).join("–"),
    });
  }
  for (const task of tasks) {
    if (task.completedAt || !task.dueAt || localDateKey(new Date(task.dueAt)) !== dayKey) continue;
    items.push({ id: `task-${task.id}`, kind: "task", title: task.title, at: new Date(task.dueAt), detail: `${task.priority} priority` });
  }
  for (const entry of entries) {
    if (localDateKey(new Date(entry.startsAt)) !== dayKey) continue;
    items.push({ id: `${entry.kind}-${entry.id}`, kind: entry.kind, title: entry.title, at: new Date(entry.startsAt) });
  }
  return items.sort((a, b) => a.at.getTime() - b.at.getTime());
}

function ActivityLink({ item }: { item: LoadItem }) {
  const href = item.kind === "class" ? "/classes" : item.kind === "task" ? "/tasks" : "/calendar";
  return <li className="flex items-start gap-3 border-t border-border py-3 first:border-t-0">
    <span className="mt-0.5 w-16 shrink-0 text-xs tabular-nums text-muted">{clock(item.at)}</span>
    <div className="min-w-0 flex-1">
      <Link href={href} className="break-words text-sm font-medium hover:text-accent">{item.title}</Link>
      {item.detail && <p className="mt-0.5 text-xs capitalize text-muted">{item.detail}</p>}
    </div>
    <span className="shrink-0 rounded-full bg-background px-2 py-1 text-[10px] font-medium text-muted">{kindLabel(item.kind)}</span>
  </li>;
}

export default function WeeklyReview() {
  const [today, setToday] = useState<Date | null>(null);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [entries, setEntries] = useState<CalendarEntryRecord[]>([]);
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [habits, setHabits] = useState<HabitRecord[]>([]);
  const [habitCompletions, setHabitCompletions] = useState<HabitCompletionRecord[]>([]);
  const [routineItems, setRoutineItems] = useState<RoutineItemRecord[]>([]);
  const [routineCompletions, setRoutineCompletions] = useState<RoutineCompletionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [nextClasses, nextTasks, nextEntries, nextSubjects, nextHabits, nextHabitCompletions, nextRoutineItems, nextRoutineCompletions] = await Promise.all([
        getRecords("classes"), getRecords("tasks"), getRecords("calendarEntries"), getRecords("subjects"),
        getRecords("habits"), getRecords("habitCompletions"), getRecords("routineItems"), getRecords("routineCompletions"),
      ]);
      setClasses(nextClasses);
      setTasks(nextTasks);
      setEntries(nextEntries);
      setSubjects(nextSubjects);
      setHabits(nextHabits);
      setHabitCompletions(nextHabitCompletions);
      setRoutineItems(nextRoutineItems);
      setRoutineCompletions(nextRoutineCompletions);
      setError("");
    } catch {
      setError("Your weekly data could not be opened. Try refreshing the page.");
    } finally {
      setToday(new Date());
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const subjectById = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);

  const review = useMemo(() => {
    if (!today) return null;
    const weekStart = mondayOf(today);
    const nextWeekStart = addDays(weekStart, 7);
    const afterNextWeek = addDays(nextWeekStart, 7);
    const weekStartKey = localDateKey(weekStart);
    const nextWeekKey = localDateKey(nextWeekStart);
    const afterNextWeekKey = localDateKey(afterNextWeek);
    const thisWeekTasks = tasks
      .filter((task) => task.completedAt && localDateKey(new Date(task.completedAt)) >= weekStartKey && localDateKey(new Date(task.completedAt)) < nextWeekKey)
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
    const overdueTasks = tasks
      .filter((task) => !task.completedAt && task.dueAt && localDateKey(new Date(task.dueAt)) < localDateKey(today))
      .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
    const thisWeekHabitCompletions = habitCompletions.filter((item) => item.date >= weekStartKey && item.date < nextWeekKey);
    const thisWeekRoutineCompletions = routineCompletions.filter((item) => item.date >= weekStartKey && item.date < nextWeekKey);
    const nextWeekDays = Array.from({ length: 7 }, (_, index) => {
      const date = addDays(nextWeekStart, index);
      return { date, items: toLoadItems(date, classes, tasks, entries, subjectById) };
    });
    return {
      weekStart,
      weekEnd: addDays(weekStart, 6),
      nextWeekStart,
      nextWeekEnd: addDays(nextWeekStart, 6),
      thisWeekTasks,
      thisWeekHabitCompletions,
      thisWeekRoutineCompletions,
      overdueTasks,
      nextWeekDays,
      nextWeekItems: nextWeekDays.reduce((sum, day) => sum + day.items.length, 0),
      afterNextWeekKey,
    };
  }, [classes, entries, habitCompletions, routineCompletions, subjectById, tasks, today]);

  const habitById = useMemo(() => new Map(habits.map((habit) => [habit.id, habit])), [habits]);
  const routineItemById = useMemo(() => new Map(routineItems.map((item) => [item.id, item])), [routineItems]);

  if (loading || !today || !review) return <section className="mx-auto w-full max-w-4xl" aria-busy="true"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent">Reflect and plan</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Weekly review</h1><p className="mt-8 rounded-2xl border border-border bg-surface p-6 text-sm text-muted">Loading your week…</p></section>;

  const totalDone = review.thisWeekTasks.length + review.thisWeekHabitCompletions.length + review.thisWeekRoutineCompletions.length;
  const totalLoad = review.nextWeekItems;

  return (
    <section className="review-page mx-auto w-full max-w-4xl">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent">Reflect and plan</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Weekly review</h1>
      <p className="mt-2 text-base text-muted">{weekLabel(review.weekStart, review.weekEnd)}</p>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">See what you finished, catch overdue tasks, and get a feel for the week ahead.</p>
      {error && <p role="alert" className="mt-5 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</p>}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Done this week" value={totalDone} detail={`${review.thisWeekTasks.length} tasks · ${review.thisWeekHabitCompletions.length} habit check-ins · ${review.thisWeekRoutineCompletions.length} routine steps`} />
        <SummaryCard label="Overdue tasks" value={review.overdueTasks.length} detail={review.overdueTasks.length ? "Open tasks past their due date" : "You’re caught up"} tone={review.overdueTasks.length ? "warning" : "normal"} />
        <SummaryCard label="Next week’s load" value={totalLoad} detail={`${review.nextWeekDays.filter((day) => day.items.length).length} days with something planned`} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="review-done-heading" className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3"><h2 id="review-done-heading" className="text-lg font-semibold">Done this week</h2><Link href="/tasks" className="text-sm font-medium text-accent hover:underline">Tasks</Link></div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <CountPill label="Tasks" count={review.thisWeekTasks.length} />
            <CountPill label="Habit check-ins" count={review.thisWeekHabitCompletions.length} />
            <CountPill label="Routine steps" count={review.thisWeekRoutineCompletions.length} />
          </div>
          {review.thisWeekTasks.length ? <ul className="mt-3 divide-y divide-border">
            {review.thisWeekTasks.slice(0, 8).map((task) => <li key={task.id} className="py-3 first:pt-0 last:pb-0"><p className="break-words text-sm font-medium">{task.title}</p><p className="mt-1 text-xs text-muted">Completed {new Date(task.completedAt!).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</p></li>)}
            {review.thisWeekTasks.length > 8 && <li className="pt-3 text-xs text-muted">And {review.thisWeekTasks.length - 8} more completed tasks.</li>}
          </ul> : <p className="mt-4 rounded-xl border border-dashed border-border px-3 py-5 text-center text-sm text-muted">No tasks completed yet this week.</p>}
          {(review.thisWeekHabitCompletions.length > 0 || review.thisWeekRoutineCompletions.length > 0) && <div className="mt-4 border-t border-border pt-3 text-xs leading-5 text-muted">
            {review.thisWeekHabitCompletions.slice(0, 4).map((completion) => <span key={completion.id} className="mr-2 inline-block rounded-full bg-accent/10 px-2.5 py-1 text-accent">{habitById.get(completion.habitId)?.title ?? "Habit"} · {completion.version === "small" ? "small" : "full"}</span>)}
            {review.thisWeekRoutineCompletions.slice(0, 4).map((completion) => <span key={completion.id} className="mr-2 inline-block rounded-full bg-background px-2.5 py-1">{routineItemById.get(completion.itemId)?.title ?? "Routine step"}</span>)}
            {(review.thisWeekHabitCompletions.length > 4 || review.thisWeekRoutineCompletions.length > 4) && <span>Showing recent check-ins.</span>}
          </div>}
        </section>

        <section aria-labelledby="review-overdue-heading" className={`rounded-2xl border p-4 sm:p-5 ${review.overdueTasks.length ? "border-red-500/25 bg-red-500/5" : "border-border bg-surface"}`}>
          <div className="flex items-center justify-between gap-3"><h2 id="review-overdue-heading" className="text-lg font-semibold">Overdue</h2><span className={`rounded-full px-3 py-1 text-xs font-semibold ${review.overdueTasks.length ? "bg-red-500/10 text-red-700 dark:text-red-300" : "bg-background text-muted"}`}>{review.overdueTasks.length}</span></div>
          {review.overdueTasks.length ? <ul className="mt-3 divide-y divide-red-500/15">
            {review.overdueTasks.map((task) => <li key={task.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"><div className="min-w-0"><p className="break-words text-sm font-medium">{task.title}</p><p className="mt-1 text-xs text-red-700 dark:text-red-300">Due {new Date(task.dueAt!).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p></div><span className="shrink-0 rounded-full bg-red-500/10 px-2.5 py-1 text-[10px] font-semibold text-red-700 dark:text-red-300">{task.priority}</span></li>)}
          </ul> : <p className="mt-4 rounded-xl border border-dashed border-border px-3 py-5 text-center text-sm text-muted">No overdue tasks. Nice work keeping up.</p>}
          {review.overdueTasks.length > 0 && <Link href="/tasks" className="mt-4 inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-semibold text-accent hover:bg-background">Review overdue tasks</Link>}
        </section>
      </div>

      <section aria-labelledby="next-week-heading" className="mt-5 rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Plan ahead</p><h2 id="next-week-heading" className="mt-1 text-lg font-semibold">Next week</h2></div>
          <p className="text-sm text-muted">{weekLabel(review.nextWeekStart, review.nextWeekEnd)} · {totalLoad} {totalLoad === 1 ? "item" : "items"}</p>
        </div>
        {totalLoad ? <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {review.nextWeekDays.filter((day) => day.items.length > 0).map(({ date, items }) => <article key={localDateKey(date)} className="rounded-xl border border-border bg-background p-3">
            <div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">{date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</h3><span className="rounded-full bg-surface px-2.5 py-1 text-xs text-muted">{items.length}</span></div>
            <ul>{items.map((item) => <ActivityLink key={item.id} item={item} />)}</ul>
          </article>)}
        </div> : <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-7 text-center text-sm text-muted">Nothing scheduled for next week. Add classes, tasks, or dates whenever you’re ready.</p>}
      </section>
    </section>
  );
}

function SummaryCard({ label, value, detail, tone = "normal" }: { label: string; value: number; detail: string; tone?: "normal" | "warning" }) {
  return <div className={`review-summary review-summary-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")} rounded-2xl border p-4 ${tone === "warning" ? "border-red-500/25 bg-red-500/5" : "border-border bg-surface"}`}>
    <p className="text-sm font-medium text-muted">{label}</p><p className={`mt-1 text-3xl font-semibold tabular-nums ${tone === "warning" ? "text-red-700 dark:text-red-300" : ""}`}>{value}</p><p className="mt-1 text-xs leading-5 text-muted">{detail}</p>
  </div>;
}

function CountPill({ label, count }: { label: string; count: number }) {
  return <span className="rounded-full bg-background px-2.5 py-1 font-medium text-muted">{label}: {count}</span>;
}
