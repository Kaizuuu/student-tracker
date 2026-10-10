"use client";

import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, format, isSameDay, parseISO, startOfDay, startOfWeek } from "date-fns";
import { getRecords, moveOverdueTaskToTomorrow, rescheduleAllOverdueTasksToTomorrow } from "@/lib/db";
import { initializeUnmarkedExamReminders } from "@/lib/examReminders";
import { dueDateTextClasses, getDueDateTone } from "@/lib/dueDateTone";
import QuickCapture from "@/components/QuickCapture";
import TodayRhythm from "@/components/TodayRhythm";
import type { CalendarEntryRecord, ClassRecord, SubjectRecord, TaskRecord } from "@/types/records";

type NextUpItem =
  | { kind: "class"; at: Date; record: ClassRecord; subject: SubjectRecord | undefined }
  | { kind: "task"; at: Date; record: TaskRecord; subject: SubjectRecord | undefined }
  | { kind: "calendar"; at: Date; record: CalendarEntryRecord; subject: SubjectRecord | undefined };

function formatTime(value: Date | string) {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function classTimeOn(date: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getSubjectName(subject: SubjectRecord | undefined) {
  return subject?.name ?? "Unlinked subject";
}

export default function TodayDashboard() {
  const [today, setToday] = useState<Date | null>(null);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [entries, setEntries] = useState<CalendarEntryRecord[]>([]);
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");
  const [movingTaskIds, setMovingTaskIds] = useState<Set<string>>(new Set());
  const [reschedulingAll, setReschedulingAll] = useState(false);

  const refreshDashboard = useCallback(async () => {
    try {
      const [nextClasses, nextEntries, nextSubjects] = await Promise.all([
        getRecords("classes"),
        getRecords("calendarEntries"),
        getRecords("subjects"),
      ]);
      await initializeUnmarkedExamReminders(nextEntries);
      const nextTasks = await getRecords("tasks");
      setClasses(nextClasses);
      setTasks(nextTasks);
      setEntries(nextEntries);
      setSubjects(nextSubjects);
      setPageError("");
    } catch {
      setPageError("Your local data could not be opened. Try refreshing the page.");
    } finally {
      setToday(new Date());
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  async function moveTaskToTomorrow(task: TaskRecord) {
    setMovingTaskIds((current) => new Set(current).add(task.id));
    setPageError("");
    setNotice("");
    try {
      const moved = await moveOverdueTaskToTomorrow(task.id);
      if (moved) setNotice(`“${task.title}” moved to tomorrow.`);
      else setNotice("That task is no longer overdue.");
      await refreshDashboard();
    } catch {
      setPageError("The task could not be rescheduled. Try again.");
    } finally {
      setMovingTaskIds((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
    }
  }

  async function rescheduleAllOverdue() {
    if (!overdueTasks.length || reschedulingAll) return;
    const taskCount = overdueTasks.length;
    const accepted = window.confirm(`Move all ${taskCount} overdue ${taskCount === 1 ? "task" : "tasks"} to tomorrow? Each task will keep its time of day.`);
    if (!accepted) return;

    setReschedulingAll(true);
    setPageError("");
    setNotice("");
    try {
      const movedCount = await rescheduleAllOverdueTasksToTomorrow();
      setNotice(movedCount ? `${movedCount} overdue ${movedCount === 1 ? "task" : "tasks"} moved to tomorrow.` : "There are no overdue tasks to reschedule.");
      await refreshDashboard();
    } catch {
      setPageError("The overdue tasks could not be rescheduled. Try again.");
    } finally {
      setReschedulingAll(false);
    }
  }

  const subjectById = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);

  const { todaysClasses, tasksDueToday, overdueTasks, upcomingEntries, nextUp } = useMemo(() => {
    if (!today) return { todaysClasses: [], tasksDueToday: [], overdueTasks: [], upcomingEntries: [], nextUp: null };

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayClasses = classes
      .filter((item) => item.dayOfWeek === now.getDay())
      .sort((left, right) => left.startTime.localeCompare(right.startTime));
    const openTasks = tasks.filter((task) => !task.completedAt);
    const dueToday = openTasks
      .filter((task) => task.dueAt && isSameDay(parseISO(task.dueAt), now))
      .sort((left, right) => (left.dueAt ?? "").localeCompare(right.dueAt ?? ""));
    const overdue = openTasks
      .filter((task) => task.dueAt && parseISO(task.dueAt) < todayStart)
      .sort((left, right) => (left.dueAt ?? "").localeCompare(right.dueAt ?? ""));
    const upcoming = entries
      .filter((entry) => parseISO(entry.startsAt) >= now)
      .sort((left, right) => left.startsAt.localeCompare(right.startsAt));

    const nextItems: NextUpItem[] = [];
    for (const classItem of todayClasses) {
      const start = classTimeOn(now, classItem.startTime);
      const end = classTimeOn(now, classItem.endTime);
      if (end >= now) nextItems.push({ kind: "class", at: start > now ? start : now, record: classItem, subject: subjectById.get(classItem.subjectId ?? "") });
    }
    for (const task of openTasks) {
      if (!task.dueAt) continue;
      const dueAt = parseISO(task.dueAt);
      if (dueAt >= now) nextItems.push({ kind: "task", at: dueAt, record: task, subject: subjectById.get(task.subjectId ?? "") });
    }
    for (const entry of upcoming) {
      nextItems.push({ kind: "calendar", at: parseISO(entry.startsAt), record: entry, subject: subjectById.get(entry.subjectId ?? "") });
    }
    nextItems.sort((left, right) => left.at.getTime() - right.at.getTime());

    return {
      todaysClasses: todayClasses,
      tasksDueToday: dueToday,
      overdueTasks: overdue,
      upcomingEntries: upcoming,
      nextUp: nextItems[0] ?? null,
    };
  }, [classes, entries, subjectById, tasks, today]);

  const weekDates = useMemo(
    () => today ? Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(today, { weekStartsOn: 1 }), index)) : [],
    [today],
  );

  function renderNextUpDetails(item: NextUpItem) {
    if (item.kind === "class") {
      const current = classTimeOn(today ?? new Date(), item.record.startTime) <= new Date();
      return {
        title: getSubjectName(item.subject),
        eyebrow: current ? "Happening now" : "Class",
        time: current ? `Until ${formatTime(classTimeOn(today ?? new Date(), item.record.endTime))}` : formatTime(item.at),
        detail: [item.record.room, item.record.teacher].filter(Boolean).join(" · "),
        tone: "none" as const,
        href: "/classes",
      };
    }
    if (item.kind === "task") {
      return {
        title: item.record.title,
        eyebrow: "Task due",
        time: formatTime(item.at),
        detail: item.subject?.name ?? "",
        tone: getDueDateTone(item.record.dueAt),
        href: "/tasks",
      };
    }
    return {
      title: item.record.title,
      eyebrow: item.record.kind === "exam" ? "Exam" : "Event",
      time: formatTime(item.at),
      detail: item.subject?.name ?? item.record.location,
      tone: getDueDateTone(item.record.startsAt),
      href: "/calendar",
    };
  }

  if (!today) {
    return (
      <section className="today-page mx-auto w-full max-w-4xl" aria-busy="true">
        <p className="section-eyebrow mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent">Your day, at a glance</p>
        <div className="h-9 w-48 animate-pulse rounded-lg bg-border" />
        <p className="mt-8 rounded-2xl border border-border bg-surface px-5 py-6 text-sm text-muted">Loading your day…</p>
      </section>
    );
  }

  const nextUpDetails = nextUp ? renderNextUpDetails(nextUp) : null;

  return (
    <section className="today-page mx-auto w-full max-w-4xl">
      <section className="today-summary-card rounded-[2rem] border border-border bg-surface p-5 sm:p-7" aria-label="Today summary">
        <p className="section-eyebrow mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent">Today · make room for good work</p>
        <div className="today-heading flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl sm:text-5xl">Make room for good work.</h1>
            <p className="mt-2 text-base font-medium text-muted sm:text-lg">{format(today, "EEEE, MMMM d")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/week" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-semibold text-foreground shadow-sm transition-colors hover:border-accent/30 hover:bg-accent/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              <CalendarDays aria-hidden="true" className="size-4 text-accent" strokeWidth={1.8} />
              Weekly calendar
            </Link>
            <Link href="/tasks" className="today-primary-action inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-accent-foreground shadow-md shadow-accent/20 transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"><Plus aria-hidden="true" className="size-4" strokeWidth={2} />Add a task</Link>
          </div>
        </div>
        <ol aria-label="This week" className="today-date-strip mt-6 grid grid-cols-7 gap-2">
          {weekDates.map((date) => {
            const isToday = isSameDay(date, today);
            return <li key={date.toISOString()} aria-label={format(date, "EEEE, MMMM d")} aria-current={isToday ? "date" : undefined} className={`today-date-chip flex min-h-[4.4rem] flex-col items-center justify-center gap-1 rounded-2xl border px-1 ${isToday ? "is-today border-accent bg-accent text-accent-foreground shadow-md shadow-accent/20" : "border-border bg-background text-foreground"}`}><span className={`text-[10px] font-semibold uppercase ${isToday ? "opacity-80" : "text-muted"}`}>{format(date, "EEEEE")}</span><span className="text-lg font-semibold leading-none">{format(date, "dd")}</span></li>;
          })}
        </ol>
      </section>

      {pageError && <p role="alert" className="mt-6 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300">{pageError}</p>}
      {notice && <p role="status" className="mt-6 rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium">{notice}</p>}
      <QuickCapture onTaskAdded={() => void refreshDashboard()} />

      {loading ? (
        <p className="mt-8 rounded-2xl border border-border bg-surface px-5 py-6 text-sm text-muted">Loading your day…</p>
      ) : (
        <div className="today-agenda-panel mt-7 space-y-5 rounded-[2rem] p-3 sm:mt-8 sm:space-y-6 sm:p-5">
          <section aria-labelledby="next-up-heading" className="today-next-up rounded-3xl border border-accent/20 bg-accent/5 p-5 sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Next up</p>
            {nextUpDetails ? (
              <Link href={nextUpDetails.href} className="mt-4 block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-muted">{nextUpDetails.eyebrow}</p>
                    <h2 id="next-up-heading" className="mt-1 break-words text-xl font-semibold sm:text-2xl">{nextUpDetails.title}</h2>
                    {nextUpDetails.detail && <p className="mt-1 break-words text-sm text-muted">{nextUpDetails.detail}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full bg-surface px-3 py-1.5 text-sm font-semibold ${dueDateTextClasses(nextUpDetails.tone)}`}>{nextUpDetails.time}</span>
                </div>
              </Link>
            ) : (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 id="next-up-heading" className="text-lg font-semibold">Nothing scheduled next</h2>
                  <p className="mt-1 text-sm text-muted">Add a class, task, or important date to see it here.</p>
                </div>
                <Link href="/calendar" className="inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-semibold text-accent hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent">Add a date</Link>
              </div>
            )}
          </section>

          {overdueTasks.length > 0 && (
            <section aria-labelledby="overdue-heading" className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-700 dark:text-red-300">Needs attention</p>
                  <h2 id="overdue-heading" className="mt-1 text-lg font-semibold text-red-800 dark:text-red-200">Overdue tasks</h2>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="rounded-full bg-red-500/10 px-3 py-1 text-sm font-semibold text-red-700 dark:text-red-300">{overdueTasks.length}</span>
                  <button type="button" onClick={() => void rescheduleAllOverdue()} disabled={reschedulingAll || movingTaskIds.size > 0} className="min-h-10 rounded-xl border border-red-500/30 px-3 text-xs font-semibold text-red-700 hover:bg-red-500/10 disabled:cursor-wait disabled:opacity-60 dark:text-red-300">{reschedulingAll ? "Moving tasks…" : "Reschedule all"}</button>
                </div>
              </div>
              <ul className="mt-4 space-y-2">
                {overdueTasks.map((task) => (
                  <li key={task.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-red-500/15 pt-3">
                    <div className="min-w-0 flex-1">
                      <Link href="/tasks" className="break-words font-medium text-red-800 hover:underline dark:text-red-200">{task.title}</Link>
                      <p className="mt-1 text-sm text-red-700 dark:text-red-300">{dateLabel(task.dueAt!)}</p>
                    </div>
                    <button type="button" onClick={() => void moveTaskToTomorrow(task)} disabled={reschedulingAll || movingTaskIds.has(task.id)} className="min-h-10 rounded-xl px-3 text-xs font-semibold text-red-700 hover:bg-red-500/10 disabled:cursor-wait disabled:opacity-60 dark:text-red-300">{movingTaskIds.has(task.id) ? "Moving…" : "Move to tomorrow"}</button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <section aria-labelledby="classes-heading" className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 id="classes-heading" className="font-semibold">Today’s classes</h2>
                <Link href="/classes" className="text-sm font-medium text-accent hover:underline">View schedule</Link>
              </div>
              {todaysClasses.length ? (
                <ol className="mt-4 space-y-3">
                  {todaysClasses.map((classItem) => {
                    const subject = subjectById.get(classItem.subjectId ?? "");
                    return (
                      <li key={classItem.id} className="flex gap-3 border-t border-border pt-3 first:border-0 first:pt-0">
                        <span className="mt-0.5 h-10 w-1 shrink-0 rounded-full" style={{ background: subject?.color ?? "var(--border)" }} aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="break-words font-medium">{getSubjectName(subject)}</p>
                          <p className="mt-1 text-sm text-muted">{formatTime(classTimeOn(today, classItem.startTime))} – {formatTime(classTimeOn(today, classItem.endTime))}</p>
                          {(classItem.room || classItem.teacher) && <p className="mt-1 break-words text-sm text-muted">{[classItem.room, classItem.teacher].filter(Boolean).join(" · ")}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="mt-4 text-sm leading-6 text-muted">No classes scheduled today.</p>
              )}
            </section>

            <section aria-labelledby="tasks-heading" className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 id="tasks-heading" className="font-semibold">Tasks due today</h2>
                <Link href="/tasks" className="text-sm font-medium text-accent hover:underline">All tasks</Link>
              </div>
              {tasksDueToday.length ? (
                <ul className="mt-4 space-y-3">
                  {tasksDueToday.map((task) => (
                    <li key={task.id} className="flex flex-wrap items-start justify-between gap-2 border-t border-border pt-3 first:border-0 first:pt-0">
                      <div className="min-w-0">
                        <Link href="/tasks" className="break-words font-medium hover:text-accent">{task.title}</Link>
                        {task.subjectId && <p className="mt-1 text-sm text-muted">{subjectById.get(task.subjectId)?.name ?? "Unlinked subject"}</p>}
                      </div>
                      {task.dueAt && <time dateTime={task.dueAt} className={`shrink-0 text-sm ${dueDateTextClasses(getDueDateTone(task.dueAt))}`}>{formatTime(task.dueAt)}</time>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm leading-6 text-muted">Nothing due today. You can add a task whenever you need.</p>
              )}
            </section>

            <div className="sm:col-span-2">
              <TodayRhythm />
            </div>

            <section aria-labelledby="dates-heading" className="rounded-2xl border border-border bg-surface p-5 sm:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <h2 id="dates-heading" className="font-semibold">Upcoming exams &amp; events</h2>
                <Link href="/calendar" className="text-sm font-medium text-accent hover:underline">Calendar</Link>
              </div>
              {upcomingEntries.length ? (
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {upcomingEntries.slice(0, 4).map((entry) => (
                    <li key={entry.id} className="min-w-0 rounded-xl bg-background p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{entry.kind}</span>
                        <time dateTime={entry.startsAt} className={`text-xs font-medium ${dueDateTextClasses(getDueDateTone(entry.startsAt, new Date(), true))}`}>{dateLabel(entry.startsAt)}</time>
                      </div>
                      <p className="mt-2 break-words font-medium">{entry.title}</p>
                      {(entry.location || entry.subjectId) && <p className="mt-1 break-words text-sm text-muted">{[entry.location, subjectById.get(entry.subjectId ?? "")?.name].filter(Boolean).join(" · ")}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm leading-6 text-muted">No upcoming exams or events.</p>
              )}
            </section>
          </div>
        </div>
      )}
    </section>
  );
}
