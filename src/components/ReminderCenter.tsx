"use client";

import Link from "next/link";
import { Clock3 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getRecords } from "@/lib/db";
import { getReminderSettings } from "@/lib/reminderSettings";
import { syncReminderBackupNow } from "@/lib/reminderSync";
import { getForgivingStreak, localDateKey } from "@/lib/habits";
import type { CalendarEntryRecord, ClassRecord, HabitCompletionRecord, HabitRecord, RoutineCompletionRecord, RoutineItemRecord, TaskRecord } from "@/types/records";

type InAppReminder = { key: string; title: string; body: string; url: string };

const SEEN_STORAGE_KEY = "student-tracker-seen-reminders-v1";
const CHECK_INTERVAL_MS = 20_000;
const REMINDER_WINDOW_MINUTES = 6;

function leadOffsets(value: number | null | undefined) {
  if (value === null) return [];
  const selected = value === 10 || value === 30 || value === 60 ? value : 10;
  return [1440, selected];
}

function leadLabel(minutes: number) {
  return minutes === 1440 ? "1 day" : minutes === 60 ? "1 hour" : `${minutes} minutes`;
}

function windowIsOpen(startsAt: Date, offset: number, now: Date) {
  const minutesUntil = (startsAt.getTime() - now.getTime()) / 60_000;
  return Number.isFinite(minutesUntil) && minutesUntil > offset - REMINDER_WINDOW_MINUTES && minutesUntil <= offset;
}

function dailyWindowIsOpen(time: string, now: Date) {
  const [hours, minutes] = time.split(":").map(Number);
  const scheduled = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
  return now >= scheduled && now.getTime() < scheduled.getTime() + 6 * 60_000;
}

function getNextClassStart(classItem: ClassRecord[], now: Date) {
  return classItem.map((item) => {
    if (!Number.isInteger(item.dayOfWeek) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.startTime)) return null;
    const [hours, minutes] = item.startTime.split(":").map(Number);
    for (let dayOffset = 0; dayOffset <= 7; dayOffset += 1) {
      const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hours, minutes, 0, 0);
      if (candidate.getDay() === item.dayOfWeek && candidate > now) return { item, startsAt: candidate };
    }
    return null;
  }).filter((value): value is { item: ClassRecord; startsAt: Date } => value !== null);
}

function loadSeenKeys() {
  try {
    const raw = localStorage.getItem(SEEN_STORAGE_KEY);
    const entries = raw ? JSON.parse(raw) as Array<[string, number]> : [];
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return new Set(entries.filter((entry) => Array.isArray(entry) && typeof entry[0] === "string" && typeof entry[1] === "number" && entry[1] > cutoff).map(([key]) => key));
  } catch {
    return new Set<string>();
  }
}

function rememberKey(key: string, seen: Set<string>) {
  seen.add(key);
  try {
    const raw = localStorage.getItem(SEEN_STORAGE_KEY);
    const entries = raw ? JSON.parse(raw) as Array<[string, number]> : [];
    const recent = entries.filter((entry) => Array.isArray(entry) && typeof entry[0] === "string" && typeof entry[1] === "number" && entry[1] > Date.now() - 30 * 24 * 60 * 60 * 1000);
    recent.push([key, Date.now()]);
    localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(recent.slice(-400)));
  } catch {
    // In-app reminders still work for the current session if local storage is unavailable.
  }
}

export default function ReminderCenter() {
  const [reminders, setReminders] = useState<InAppReminder[]>([]);
  const seenKeys = useRef<Set<string> | null>(null);

  useEffect(() => {
    const seen = loadSeenKeys();
    seenKeys.current = seen;

    function showReminder(reminder: InAppReminder) {
      if (!reminder.key || !reminder.title || !reminder.body || !reminder.url.startsWith("/") || reminder.url.startsWith("//")) return;
      const keys = seenKeys.current ?? new Set<string>();
      if (keys.has(reminder.key)) return;
      rememberKey(reminder.key, keys);
      seenKeys.current = keys;
      setReminders((current) => [...current.filter((item) => item.key !== reminder.key), reminder].slice(-3));
    }

    function onServiceWorkerMessage(event: MessageEvent) {
      const data = event.data as { type?: unknown; reminder?: unknown } | null;
      if (!data || data.type !== "student-tracker-reminder" || typeof data.reminder !== "object" || data.reminder === null) return;
      const incoming = data.reminder as Partial<InAppReminder>;
      if (typeof incoming.key === "string" && typeof incoming.title === "string" && typeof incoming.body === "string" && typeof incoming.url === "string") {
        showReminder(incoming as InAppReminder);
      }
    }

    async function checkLocalReminders() {
      if (document.visibilityState !== "visible") return;
      try {
        const [tasks, classes, entries, subjects, habits, habitCompletions, routineItems, routineCompletions] = await Promise.all([
          getRecords("tasks"),
          getRecords("classes"),
          getRecords("calendarEntries"),
          getRecords("subjects"),
          getRecords("habits"),
          getRecords("habitCompletions"),
          getRecords("routineItems"),
          getRecords("routineCompletions"),
        ]);
        const now = new Date();
        const today = localDateKey(now);
        const settings = getReminderSettings();

        function addIfDue(key: string, title: string, body: string, url: string, startsAt: Date, offset: number) {
          if (windowIsOpen(startsAt, offset, now)) showReminder({ key, title, body, url });
        }

        for (const task of tasks as TaskRecord[]) {
          if (!task || task.completedAt || !task.dueAt) continue;
          const due = new Date(task.dueAt);
          if (!Number.isFinite(due.getTime())) continue;
          for (const offset of leadOffsets(task.reminderMinutesBefore)) {
            addIfDue(`task:${task.id}:${task.dueAt}:before:${offset}`, "Task reminder", `${task.title} is due in ${leadLabel(offset)}.`, "/tasks", due, offset);
          }
        }

        for (const entry of entries as CalendarEntryRecord[]) {
          if (!entry?.id || !entry.title || !entry.startsAt) continue;
          const startsAt = new Date(entry.startsAt);
          if (!Number.isFinite(startsAt.getTime())) continue;
          const kind = entry.kind === "exam" ? "Exam" : "Event";
          for (const offset of leadOffsets(entry.reminderMinutesBefore)) {
            addIfDue(`${kind.toLowerCase()}:${entry.id}:${entry.startsAt}:before:${offset}`, `${kind} reminder`, `${entry.title} starts in ${leadLabel(offset)}.`, "/calendar", startsAt, offset);
          }
        }

        const subjectNames = new Map(subjects.map((subject) => [subject.id, subject.name]));
        for (const { item, startsAt } of getNextClassStart(classes as ClassRecord[], now)) {
          const subject = item.subjectId ? subjectNames.get(item.subjectId) : undefined;
          const classLabel = subject ? `${subject} class` : "Class";
          for (const offset of leadOffsets(item.reminderMinutesBefore)) {
            addIfDue(`class:${item.id}:${startsAt.toISOString()}:before:${offset}`, "Class reminder", `${classLabel} starts in ${leadLabel(offset)}.`, "/classes", startsAt, offset);
          }
        }

        const habitRecords = habits as HabitRecord[];
        const habitCheckins = habitCompletions as HabitCompletionRecord[];
        const checkedHabits = new Set(habitCheckins.filter((entry) => entry.date === today).map((entry) => entry.habitId));
        const pendingHabits = habitRecords.filter((habit) => !checkedHabits.has(habit.id));
        if (pendingHabits.length && dailyWindowIsOpen(settings.habitTime, now)) {
          const names = pendingHabits.slice(0, 3).map((habit) => habit.title).join(", ");
          showReminder({
            key: `habit-checkin:${today}`,
            title: "Habit check-in",
            body: `${pendingHabits.length} habit${pendingHabits.length === 1 ? "" : "s"} still to check off${names ? `: ${names}` : ""}.`,
            url: "/habits",
          });
        }

        const routineRecords = routineItems as RoutineItemRecord[];
        const routineCheckins = routineCompletions as RoutineCompletionRecord[];
        for (const period of ["morning", "night"] as const) {
          const pending = routineRecords.filter((item) => item.period === period && !routineCheckins.some((entry) => entry.itemId === item.id && entry.date === today));
          const time = period === "morning" ? settings.morningRoutineTime : settings.nightRoutineTime;
          if (!pending.length || !dailyWindowIsOpen(time, now)) continue;
          showReminder({
            key: `routine:${period}:${today}`,
            title: `${period === "morning" ? "Morning" : "Night"} routine`,
            body: `${pending.length} step${pending.length === 1 ? "" : "s"} left to check off.`,
            url: "/routines",
          });
        }

        const streakHabits = pendingHabits.filter((habit) => getForgivingStreak(
          habitCheckins.filter((entry) => entry.habitId === habit.id).map((entry) => entry.date),
          today,
        ) > 0);
        if (streakHabits.length && dailyWindowIsOpen(settings.streakNudgeTime, now)) {
          showReminder({
            key: `streak-nudge:${today}`,
            title: "Keep your habit streak going",
            body: `Check in on ${streakHabits.slice(0, 3).map((habit) => habit.title).join(", ")} today.`,
            url: "/habits",
          });
        }
      } catch {
        // Push reminders remain available even if local planner data cannot be read.
      }
    }

    navigator.serviceWorker?.addEventListener("message", onServiceWorkerMessage);
    const retryReminderSync = () => void syncReminderBackupNow().catch(() => {
      // The next app launch or network connection retries the background schedule upload.
    });
    window.addEventListener("online", retryReminderSync);
    retryReminderSync();
    void checkLocalReminders();
    const interval = window.setInterval(() => void checkLocalReminders(), CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", checkLocalReminders);
    window.addEventListener("student-tracker-reminder-settings", checkLocalReminders);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", onServiceWorkerMessage);
      window.removeEventListener("online", retryReminderSync);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", checkLocalReminders);
      window.removeEventListener("student-tracker-reminder-settings", checkLocalReminders);
    };
  }, []);

  if (!reminders.length) return null;

  return <aside aria-label="Upcoming reminders" aria-live="polite" className="pointer-events-none fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+6rem)] z-40 mx-auto flex max-w-lg flex-col gap-2">
    {reminders.map((reminder) => <div key={reminder.key} className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-border bg-surface/95 p-4 shadow-[0_12px_36px_rgb(20_55_75_/_20%)] backdrop-blur-xl">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent" aria-hidden="true"><Clock3 className="size-[18px]" strokeWidth={1.8} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{reminder.title}</p>
        <p className="mt-0.5 break-words text-sm text-muted">{reminder.body}</p>
        <Link href={reminder.url} onClick={() => setReminders((current) => current.filter((item) => item.key !== reminder.key))} className="mt-2 inline-flex min-h-9 items-center text-sm font-semibold text-accent">Open planner</Link>
      </div>
      <button type="button" onClick={() => setReminders((current) => current.filter((item) => item.key !== reminder.key))} aria-label="Dismiss reminder" className="flex size-9 shrink-0 items-center justify-center rounded-xl text-lg text-muted hover:bg-background">×</button>
    </div>)}
  </aside>;
}
