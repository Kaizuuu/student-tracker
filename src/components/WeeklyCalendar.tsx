"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getRecords } from "@/lib/db";
import type { CalendarEntryRecord, ClassRecord, SubjectRecord, TaskRecord, TaskPriority } from "@/types/records";

type CalendarView = "day" | "week" | "month";
type ActivityFilter = "all" | "class" | "task" | "exam" | "event";
type CalendarActivity = {
  id: string;
  kind: Exclude<ActivityFilter, "all">;
  title: string;
  startsAt: Date;
  endsAt?: Date;
  subject?: SubjectRecord;
  detail?: string;
  priority?: TaskPriority;
  completed?: boolean;
};

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const ACTIVITY_FILTERS: { value: ActivityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "class", label: "Classes" },
  { value: "task", label: "Tasks" },
  { value: "exam", label: "Exams" },
  { value: "event", label: "Events" },
];
const PRIORITIES: { value: TaskPriority | "all"; label: string }[] = [
  { value: "all", label: "All priorities" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Mid" },
  { value: "high", label: "High" },
];

function dayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function mondayOf(date: Date) {
  const monday = dayStart(date);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

function classDate(date: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours || 0, minutes || 0);
}

function clock(date: Date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function timeRange(start: Date, end?: Date) {
  return end ? `${clock(start)} – ${clock(end)}` : clock(start);
}

function activityColor(kind: CalendarActivity["kind"], priority?: TaskPriority) {
  if (kind === "task") {
    if (priority === "high") return "border-l-red-500 bg-red-500/8";
    if (priority === "medium") return "border-l-amber-500 bg-amber-500/8";
    return "border-l-slate-400 bg-slate-500/5";
  }
  if (kind === "exam") return "border-l-red-500 bg-red-500/8";
  if (kind === "event") return "border-l-amber-500 bg-amber-500/8";
  return "border-l-accent bg-accent/8";
}

function kindLabel(kind: CalendarActivity["kind"]) {
  return kind === "class" ? "Class" : kind === "task" ? "Task" : kind === "exam" ? "Exam" : "Event";
}

function getActivities(
  date: Date,
  classes: ClassRecord[],
  tasks: TaskRecord[],
  entries: CalendarEntryRecord[],
  subjects: Map<string, SubjectRecord>,
): CalendarActivity[] {
  const items: CalendarActivity[] = [];
  for (const record of classes) {
    if (record.dayOfWeek !== date.getDay()) continue;
    items.push({
      id: `class-${record.id}`,
      kind: "class",
      title: subjects.get(record.subjectId ?? "")?.name ?? "Class",
      startsAt: classDate(date, record.startTime),
      endsAt: classDate(date, record.endTime),
      subject: subjects.get(record.subjectId ?? ""),
      detail: [record.room, record.teacher].filter(Boolean).join(" · "),
    });
  }
  for (const task of tasks) {
    if (!task.dueAt || !sameDay(new Date(task.dueAt), date)) continue;
    items.push({
      id: `task-${task.id}`,
      kind: "task",
      title: task.title,
      startsAt: new Date(task.dueAt),
      subject: subjects.get(task.subjectId ?? ""),
      priority: task.priority,
      completed: Boolean(task.completedAt),
    });
  }
  for (const entry of entries) {
    if (!sameDay(new Date(entry.startsAt), date)) continue;
    items.push({
      id: `${entry.kind}-${entry.id}`,
      kind: entry.kind,
      title: entry.title,
      startsAt: new Date(entry.startsAt),
      endsAt: entry.endsAt ? new Date(entry.endsAt) : undefined,
      subject: subjects.get(entry.subjectId ?? ""),
      detail: entry.location || undefined,
    });
  }
  return items.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

function filtered(items: CalendarActivity[], type: ActivityFilter, priority: TaskPriority | "all") {
  return items.filter((item) => {
    if (type !== "all" && item.kind !== type) return false;
    if (priority !== "all" && (item.kind !== "task" || item.priority !== priority)) return false;
    return true;
  });
}

function ActivityCard({ item, compact = false }: { item: CalendarActivity; compact?: boolean }) {
  const priorityClasses = item.priority === "high"
    ? "bg-red-500/10 text-red-700 dark:text-red-300"
    : item.priority === "medium"
      ? "bg-amber-500/10 text-amber-800 dark:text-amber-300"
      : "bg-background text-muted";
  return (
    <article className={`rounded-xl border border-border border-l-[3px] px-3 py-2.5 ${activityColor(item.kind, item.priority)} ${item.completed ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <span>{timeRange(item.startsAt, item.endsAt)}</span>
        <span className="rounded-full bg-background/70 px-2 py-0.5">{kindLabel(item.kind)}</span>
        {item.priority && <span className={`rounded-full px-2 py-0.5 ${priorityClasses}`}>{item.priority === "medium" ? "Mid" : item.priority}</span>}
      </div>
      <p className={`mt-1 font-semibold leading-snug ${compact ? "text-sm" : "text-base"} ${item.completed ? "line-through" : ""}`}>{item.title}</p>
      {!compact && (item.subject || item.detail) && (
        <p className="mt-1 text-xs text-muted">{[item.subject?.name, item.detail].filter(Boolean).join(" · ")}</p>
      )}
    </article>
  );
}

export default function WeeklyCalendar() {
  const [view, setView] = useState<CalendarView>("week");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">("all");
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [entries, setEntries] = useState<CalendarEntryRecord[]>([]);
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const weekDayRefs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    let active = true;
    setSelectedDate(dayStart(new Date()));
    void Promise.all([getRecords("classes"), getRecords("tasks"), getRecords("calendarEntries"), getRecords("subjects")])
      .then(([nextClasses, nextTasks, nextEntries, nextSubjects]) => {
        if (!active) return;
        setClasses(nextClasses);
        setTasks(nextTasks);
        setEntries(nextEntries);
        setSubjects(nextSubjects);
        setError("");
      })
      .catch(() => { if (active) setError("Your calendar data could not be opened. Try refreshing the page."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (view !== "week" || !selectedDate) return;
    weekDayRefs.current.get(dateKey(selectedDate))?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [view, selectedDate]);

  const subjectMap = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);
  const weekDays = useMemo(() => selectedDate ? Array.from({ length: 7 }, (_, index) => {
    const date = mondayOf(selectedDate);
    date.setDate(date.getDate() + index);
    return date;
  }) : [], [selectedDate]);
  const monthDays = useMemo(() => {
    if (!selectedDate) return [];
    const first = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const start = mondayOf(first);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(date.getDate() + index);
      return date;
    });
  }, [selectedDate]);

  const title = !selectedDate
    ? "Loading date…"
    : view === "month"
      ? selectedDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : view === "week"
        ? `${weekDays[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${weekDays[6].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
        : selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  function changeDate(direction: number) {
    setSelectedDate((current) => {
      if (!current) return current;
      const next = new Date(current);
      if (view === "month") next.setMonth(next.getMonth() + direction, 1);
      else next.setDate(next.getDate() + direction * (view === "week" ? 7 : 1));
      return next;
    });
  }

  function selectActivityFilter(value: ActivityFilter) {
    setActivityFilter(value);
    if (value !== "all" && value !== "task") setPriorityFilter("all");
  }

  const showPriority = activityFilter === "all" || activityFilter === "task";

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 px-4 py-5 sm:px-6 sm:py-7">
      <header className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-center justify-between gap-3 sm:justify-start">
          <button type="button" onClick={() => changeDate(-1)} className="min-h-11 min-w-11 rounded-xl border border-border text-xl text-muted hover:bg-background" aria-label="Previous date">‹</button>
          <div className="min-w-0 text-center sm:text-left">
            <h1 className="truncate text-lg font-bold sm:text-xl">{title}</h1>
            <button type="button" onClick={() => setSelectedDate(dayStart(new Date()))} className="mt-0.5 text-sm font-medium text-accent">Today</button>
          </div>
          <button type="button" onClick={() => changeDate(1)} className="min-h-11 min-w-11 rounded-xl border border-border text-xl text-muted hover:bg-background" aria-label="Next date">›</button>
        </div>
        <div className="mt-3 flex justify-center rounded-xl bg-background p-1 sm:mt-0" aria-label="Calendar view">
          {([["day", "Daily"], ["week", "Weekly"], ["month", "Monthly"]] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => { if (value === "day") setSelectedDate(dayStart(new Date())); setView(value); }} aria-pressed={view === value} className={`min-h-10 flex-1 rounded-lg px-3 text-sm font-semibold sm:flex-none ${view === value ? "bg-surface text-accent shadow-sm" : "text-muted hover:text-foreground"}`}>{label}</button>
          ))}
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-surface p-3 sm:p-4" aria-label="Calendar filters">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {ACTIVITY_FILTERS.map(({ value, label }) => (
            <button key={value} type="button" onClick={() => selectActivityFilter(value)} aria-pressed={activityFilter === value} className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium ${activityFilter === value ? "border-accent bg-accent/10 text-accent" : "border-border text-muted hover:bg-background"}`}>{label}</button>
          ))}
        </div>
        {showPriority && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted">Task priority</span>
          {PRIORITIES.map(({ value, label }) => (
            <button key={value} type="button" onClick={() => setPriorityFilter(value)} aria-pressed={priorityFilter === value} className={`min-h-9 rounded-full px-3 text-xs font-semibold ${priorityFilter === value ? value === "high" ? "bg-red-500/10 text-red-700 dark:text-red-300" : value === "medium" ? "bg-amber-500/10 text-amber-800 dark:text-amber-300" : value === "low" ? "bg-slate-500/10 text-muted" : "bg-accent/10 text-accent" : "bg-background text-muted"}`}>{label}</button>
          ))}
        </div>}
      </section>

      {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {loading || !selectedDate ? <div className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted">Loading your calendar…</div> : <>
        {view === "day" && <section className="space-y-3" aria-label="Daily schedule">
          <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
            <p className="text-sm font-medium text-muted">{selectedDate?.toLocaleDateString(undefined, { weekday: "long" })}</p>
            <div className="mt-1 flex items-end gap-3"><span className="text-5xl font-bold leading-none text-accent sm:text-6xl">{selectedDate?.getDate()}</span><span className="pb-1 text-sm text-muted">{selectedDate?.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span></div>
          </div>
          {(() => {
            const items = filtered(getActivities(selectedDate, classes, tasks, entries, subjectMap), activityFilter, priorityFilter);
            return items.length ? <div className="space-y-2">{items.map((item) => <ActivityCard key={item.id} item={item} />)}</div> : <EmptyState />;
          })()}
        </section>}

        {view === "week" && <section aria-label="Weekly schedule" className="space-y-3">
          <div className="flex items-center justify-between px-1"><p className="text-sm font-semibold text-muted">Swipe to see each day</p><span className="text-xs text-muted">{weekDays.length} days</span></div>
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-3 sm:gap-4">
            {weekDays.map((date) => {
              const items = filtered(getActivities(date, classes, tasks, entries, subjectMap), activityFilter, priorityFilter);
              const selected = sameDay(date, selectedDate);
              return <article key={date.toISOString()} ref={(element) => { const key = dateKey(date); if (element) weekDayRefs.current.set(key, element); else weekDayRefs.current.delete(key); }} aria-current={selected ? "date" : undefined} className={`w-[84%] min-w-[84%] snap-center rounded-2xl border bg-surface p-3 transition-[border-color,box-shadow] sm:w-[48%] sm:min-w-[48%] xl:w-[31%] xl:min-w-[31%] ${selected ? "border-accent/50 ring-2 ring-accent/15" : "border-border"}`}>
                <button type="button" onClick={() => { setSelectedDate(dayStart(date)); setView("day"); }} aria-label={`Open ${date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} in daily view`} className={`mb-3 flex w-full items-center justify-between rounded-xl px-3 py-3 text-left ${selected ? "bg-accent/10" : "bg-background"}`}>
                  <div><p className="text-sm font-semibold">{WEEKDAYS[(date.getDay() + 6) % 7]}</p><p className="mt-1 text-xs text-muted">{date.toLocaleDateString(undefined, { month: "short" })}</p></div>
                  <span className={`text-4xl font-bold leading-none ${selected ? "text-accent" : "text-foreground"}`}>{date.getDate()}</span>
                  <span className="rounded-full bg-surface px-2.5 py-1 text-xs text-muted">{items.length} {items.length === 1 ? "item" : "items"}</span>
                </button>
                {items.length ? <>
                  <div className="space-y-2">{items.slice(0, 3).map((item) => <ActivityCard key={item.id} item={item} compact />)}</div>
                  {items.length > 3 && <button type="button" onClick={() => { setSelectedDate(dayStart(date)); setView("day"); }} className="mt-3 min-h-10 w-full rounded-xl bg-background px-3 text-sm font-semibold text-accent hover:bg-accent/10">View all {items.length} items <span aria-hidden="true">→</span></button>}
                </> : <p className="rounded-xl border border-dashed border-border px-3 py-5 text-center text-sm text-muted">No planned items</p>}
              </article>;
            })}
          </div>
          <div className="flex justify-center gap-1.5" aria-hidden="true">{weekDays.map((date) => <span key={date.toISOString()} className={`h-1.5 w-1.5 rounded-full ${sameDay(date, selectedDate) ? "bg-accent" : "bg-border"}`} />)}</div>
        </section>}

        {view === "month" && <section className="rounded-2xl border border-border bg-surface p-3 sm:p-4" aria-label="Monthly calendar">
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {WEEKDAYS.map((day) => <p key={day} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted sm:text-xs">{day.slice(0, 3)}</p>)}
            {monthDays.map((date) => {
              const items = filtered(getActivities(date, classes, tasks, entries, subjectMap), activityFilter, priorityFilter);
              const inMonth = date.getMonth() === selectedDate.getMonth();
              return <button key={date.toISOString()} type="button" onClick={() => { setSelectedDate(dayStart(date)); setView("day"); }} className={`flex min-h-14 flex-col items-center justify-center rounded-lg border p-1 sm:min-h-16 ${inMonth ? "border-border bg-background" : "border-transparent bg-transparent text-muted opacity-45"} ${sameDay(date, new Date()) ? "ring-1 ring-accent" : ""}`}>
                <span className={`text-sm font-semibold ${sameDay(date, selectedDate) ? "text-accent" : ""}`}>{date.getDate()}</span>
                <span className="mt-1 flex h-1.5 items-center gap-0.5">
                  {items.slice(0, 4).map((item) => <i key={item.id} className={`h-1.5 w-1.5 rounded-full ${item.kind === "class" ? "bg-accent" : item.kind === "task" ? item.priority === "high" ? "bg-red-500" : item.priority === "medium" ? "bg-amber-500" : "bg-slate-400" : item.kind === "exam" ? "bg-red-500" : "bg-amber-500"}`} />)}
                </span>
              </button>;
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-3 text-xs text-muted">
            {[["bg-accent", "Class"], ["bg-slate-400", "Task"], ["bg-red-500", "Exam / high priority"], ["bg-amber-500", "Event / medium priority"]].map(([color, label]) => <span key={label} className="flex items-center gap-1.5"><i className={`h-2 w-2 rounded-full ${color}`} />{label}</span>)}
          </div>
          <p className="mt-3 text-center text-xs text-muted">Select a date to open its daily schedule.</p>
        </section>}
      </>}

      <nav className="flex flex-wrap gap-2 text-sm" aria-label="Calendar actions">
        <Link href="/tasks" className="rounded-xl border border-border bg-surface px-4 py-2.5 font-medium hover:bg-background">Manage tasks</Link>
        <Link href="/calendar" className="rounded-xl border border-border bg-surface px-4 py-2.5 font-medium hover:bg-background">Manage exams &amp; events</Link>
        <Link href="/classes" className="rounded-xl border border-border bg-surface px-4 py-2.5 font-medium hover:bg-background">Manage classes</Link>
      </nav>
    </main>
  );
}

function EmptyState() {
  return <div className="rounded-2xl border border-dashed border-border bg-surface px-5 py-10 text-center">
    <p className="font-semibold">Nothing planned for this day</p>
    <p className="mt-1 text-sm text-muted">Try another filter or add an activity.</p>
    <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm">
      <Link href="/tasks" className="rounded-xl bg-accent/10 px-4 py-2 font-medium text-accent">Add a task</Link>
      <Link href="/calendar" className="rounded-xl bg-background px-4 py-2 font-medium">Add an event</Link>
    </div>
  </div>;
}
