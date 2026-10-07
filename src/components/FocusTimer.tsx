"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addRecord, getRecord, getRecords } from "@/lib/db";
import ChoicePicker from "@/components/ChoicePicker";
import { localDateKey } from "@/lib/habits";
import type { FocusSessionRecord, SubjectRecord, TaskRecord } from "@/types/records";

type TimerMode = "focus" | "break";
type TimerState = {
  mode: TimerMode;
  taskId: string;
  durationSeconds: number;
  breakSeconds: number;
  remainingSeconds: number;
  endsAt: number | null;
  running: boolean;
  startedAt: string;
};

const TIMER_STORAGE_KEY = "student-tracker-focus-timer";
const PRESETS = [
  { label: "25 / 5 min", focusSeconds: 25 * 60, breakSeconds: 5 * 60 },
  { label: "50 / 10 min", focusSeconds: 50 * 60, breakSeconds: 10 * 60 },
] as const;

function isTimerState(value: unknown): value is TimerState {
  if (!value || typeof value !== "object") return false;
  const timer = value as Partial<TimerState>;
  return (timer.mode === "focus" || timer.mode === "break")
    && typeof timer.taskId === "string"
    && Number.isInteger(timer.durationSeconds) && Number(timer.durationSeconds) > 0
    && Number.isInteger(timer.breakSeconds) && Number(timer.breakSeconds) > 0
    && Number.isInteger(timer.remainingSeconds) && Number(timer.remainingSeconds) >= 0
    && (timer.endsAt === null || typeof timer.endsAt === "number")
    && typeof timer.running === "boolean"
    && typeof timer.startedAt === "string";
}

function formatClock(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, "0");
  const remainder = (safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
  return `${remainder}s`;
}

function remainingFor(timer: TimerState) {
  if (!timer.running || timer.endsAt === null) return timer.remainingSeconds;
  return Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000));
}

export default function FocusTimer() {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [sessions, setSessions] = useState<FocusSessionRecord[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [presetIndex, setPresetIndex] = useState(0);
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const completionHandled = useRef(false);

  const refreshSessions = useCallback(async () => {
    const nextSessions = await getRecords("focusSessions");
    setSessions(nextSessions.sort((left, right) => right.endedAt.localeCompare(left.endedAt)));
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([getRecords("tasks"), getRecords("subjects"), getRecords("focusSessions")])
      .then(([nextTasks, nextSubjects, nextSessions]) => {
        if (!active) return;
        setTasks(nextTasks);
        setSubjects(nextSubjects);
        setSessions(nextSessions.sort((left, right) => right.endedAt.localeCompare(left.endedAt)));
        let storedTimer: unknown = null;
        try {
          const stored = window.localStorage.getItem(TIMER_STORAGE_KEY);
          storedTimer = stored ? JSON.parse(stored) as unknown : null;
        } catch {
          try { window.localStorage.removeItem(TIMER_STORAGE_KEY); } catch { /* Storage may be disabled by the browser. */ }
        }
        if (isTimerState(storedTimer) && nextTasks.some((task) => task.id === storedTimer.taskId)) {
          const restored: TimerState = storedTimer.running && storedTimer.endsAt !== null
            ? { ...storedTimer, remainingSeconds: remainingFor(storedTimer) }
            : storedTimer;
          setTimer(restored);
          setSelectedTaskId(restored.taskId);
        } else if (storedTimer !== null) {
          try { window.localStorage.removeItem(TIMER_STORAGE_KEY); } catch { /* Storage may be disabled by the browser. */ }
          setNotice("The previous timer was cleared because its task is no longer available.");
        }
        setError("");
      })
      .catch(() => { if (active) setError("Your study timer data could not be opened. Try refreshing the page."); })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setHydrated(true);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (timer) window.localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(timer));
      else window.localStorage.removeItem(TIMER_STORAGE_KEY);
    } catch {
      // IndexedDB still records completed sessions if local timer recovery is unavailable.
    }
  }, [hydrated, timer]);

  const finishFocus = useCallback(async (snapshot: TimerState, remainingSeconds: number) => {
    if (completionHandled.current) return;
    const durationSeconds = Math.max(0, snapshot.durationSeconds - remainingSeconds);
    if (durationSeconds < 1) {
      completionHandled.current = true;
      setTimer(null);
      return;
    }

    completionHandled.current = true;
    const endedAt = snapshot.running && remainingSeconds === 0 && snapshot.endsAt !== null
      ? new Date(snapshot.endsAt)
      : new Date();
    try {
      const currentTask = await getRecord("tasks", snapshot.taskId);
      const session = await addRecord("focusSessions", {
        taskId: currentTask?.id ?? null,
        subjectId: currentTask?.subjectId ?? null,
        startedAt: snapshot.startedAt,
        endedAt: endedAt.toISOString(),
        durationSeconds,
      });
      setSessions((current) => [session, ...current].sort((left, right) => right.endedAt.localeCompare(left.endedAt)));
      setNotice(`Logged ${formatDuration(durationSeconds)} of study time.`);
      setError("");
      setTimer({
        ...snapshot,
        mode: "break",
        remainingSeconds: snapshot.breakSeconds,
        endsAt: null,
        running: false,
      });
    } catch {
      completionHandled.current = false;
      setError("Study time could not be saved. Try ending the focus block again.");
      setTimer({ ...snapshot, remainingSeconds: 0, endsAt: null, running: false });
    }
  }, []);

  useEffect(() => {
    if (!hydrated || !timer?.running || timer.endsAt === null) return;
    const tick = () => {
      const remaining = remainingFor(timer);
      if (remaining === 0) {
        if (timer.mode === "focus") void finishFocus(timer, 0);
        else {
          setTimer(null);
          setNotice("Break complete. Ready for another focus block?");
        }
      } else if (remaining !== timer.remainingSeconds) {
        setTimer((current) => current === timer ? { ...current, remainingSeconds: remaining } : current);
      }
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [finishFocus, hydrated, timer]);

  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const subjectById = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const studyTotals = useMemo(() => {
    const today = localDateKey(new Date());
    const totals = new Map<string, { today: number; allTime: number }>();
    for (const session of sessions) {
      const key = session.subjectId ?? "unlinked";
      const total = totals.get(key) ?? { today: 0, allTime: 0 };
      total.allTime += session.durationSeconds;
      if (localDateKey(new Date(session.endedAt)) === today) total.today += session.durationSeconds;
      totals.set(key, total);
    }
    return [...totals.entries()].sort((left, right) => right[1].allTime - left[1].allTime);
  }, [sessions]);

  function startFocus() {
    if (!selectedTaskId || timer) return;
    const preset = PRESETS[presetIndex];
    const now = Date.now();
    completionHandled.current = false;
    setError("");
    setNotice("");
    setTimer({
      mode: "focus",
      taskId: selectedTaskId,
      durationSeconds: preset.focusSeconds,
      breakSeconds: preset.breakSeconds,
      remainingSeconds: preset.focusSeconds,
      endsAt: now + preset.focusSeconds * 1000,
      running: true,
      startedAt: new Date(now).toISOString(),
    });
  }

  function pauseTimer() {
    if (!timer) return;
    setTimer({ ...timer, remainingSeconds: remainingFor(timer), endsAt: null, running: false });
  }

  function resumeTimer() {
    if (!timer || timer.running) return;
    setTimer({ ...timer, endsAt: Date.now() + timer.remainingSeconds * 1000, running: true });
  }

  function endFocusEarly() {
    if (!timer || timer.mode !== "focus") return;
    void finishFocus(timer, remainingFor(timer));
  }

  function startBreak() {
    if (!timer || timer.mode !== "break" || timer.running) return;
    setTimer({ ...timer, endsAt: Date.now() + timer.remainingSeconds * 1000, running: true });
    setNotice("");
  }

  const shownSeconds = timer ? remainingFor(timer) : 0;
  const elapsedSeconds = timer?.mode === "focus" ? timer.durationSeconds - shownSeconds : 0;
  const canEndEarly = Boolean(timer?.mode === "focus" && elapsedSeconds > 0);

  return (
    <section className="mx-auto w-full max-w-3xl">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent">Study with intention</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Focus timer</h1>
      <p className="mt-2 max-w-xl text-base leading-7 text-muted">Work in a focused block, then take a short break. Finished time is saved to the task and its subject.</p>

      {error && <p role="alert" className="mt-5 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium">{notice}</p>}

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section aria-label="Pomodoro timer" className="rounded-3xl border border-border bg-surface p-5 text-center sm:p-8">
          {timer ? <>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{timer.mode === "focus" ? "Focus block" : "Break"}</p>
            <p className="mt-2 text-sm text-muted">{timer.mode === "focus" ? selectedTask?.title ?? "Selected task" : "Rest your mind before the next block."}</p>
            <p role="timer" aria-live="off" className="mt-5 font-mono text-6xl font-semibold tabular-nums tracking-tight sm:text-7xl">{formatClock(shownSeconds)}</p>
            {timer.mode === "focus" && <p className="mt-2 text-sm text-muted">{subjectById.get(selectedTask?.subjectId ?? "")?.name ?? "No linked subject"}</p>}
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {timer.running
                ? <button type="button" onClick={pauseTimer} className="min-h-11 min-w-32 rounded-xl border border-border px-5 text-sm font-semibold hover:bg-background">Pause</button>
                : timer.mode === "focus"
                  ? <button type="button" onClick={resumeTimer} disabled={shownSeconds === 0} className="min-h-11 min-w-32 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground disabled:opacity-50">Resume</button>
                  : <button type="button" onClick={startBreak} className="min-h-11 min-w-32 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground">Start break</button>}
              {timer.mode === "focus" && <button type="button" onClick={endFocusEarly} disabled={!canEndEarly} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-muted hover:bg-background disabled:opacity-40">End &amp; log time</button>}
              {timer.mode === "break" && <button type="button" onClick={() => { setTimer(null); setNotice("Break skipped. Your task is ready for another focus block."); }} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-muted hover:bg-background">Skip break</button>}
            </div>
          </> : <>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Ready when you are</p>
            <p className="mt-3 font-mono text-6xl font-semibold tabular-nums tracking-tight sm:text-7xl">{formatClock(PRESETS[presetIndex].focusSeconds)}</p>
            <p className="mt-2 text-sm text-muted">{PRESETS[presetIndex].label} · focus then break</p>
            <button type="button" onClick={startFocus} disabled={!selectedTaskId || loading || !hydrated} className="mt-6 min-h-12 rounded-xl bg-accent px-6 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">Start focus</button>
          </>}
        </section>

        <section aria-labelledby="focus-setup-heading" className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
          <h2 id="focus-setup-heading" className="text-lg font-semibold">Set up a block</h2>
          <label htmlFor="focus-task" className="mt-4 block text-sm font-medium">Task</label>
          <ChoicePicker id="focus-task" value={timer?.taskId ?? selectedTaskId} placeholder="Choose a task" disabled={Boolean(timer) || loading} options={[{ value: "", label: "Choose a task", marker: "+", description: "Pick a task to focus on" }, ...tasks.map((task) => ({ value: task.id, label: task.title, marker: task.completedAt ? "✓" : "•", description: task.completedAt ? "Completed" : "Open task" }))]} onChange={setSelectedTaskId} />
          {tasks.length === 0 && !loading && <Link href="/tasks" className="mt-2 inline-block text-sm font-medium text-accent underline underline-offset-2">Add a task first</Link>}
          {selectedTask && <p className="mt-2 text-sm text-muted">Subject: {subjectById.get(selectedTask.subjectId ?? "")?.name ?? "Unlinked"}</p>}

          <label htmlFor="focus-preset" className="mt-5 block text-sm font-medium">Focus and break length</label>
          <ChoicePicker id="focus-preset" value={String(presetIndex)} disabled={Boolean(timer)} options={PRESETS.map((preset, index) => ({ value: String(index), label: preset.label, marker: "◷", description: `${preset.focusSeconds / 60} minute focus session` }))} onChange={(value) => setPresetIndex(Number(value))} />
          <p className="mt-4 text-xs leading-5 text-muted">Timer progress is saved on this device, so you can leave the page and return. Only focus time is counted; breaks are not.</p>
        </section>
      </div>

      <section aria-labelledby="study-totals-heading" className="mt-5 rounded-3xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Your progress</p><h2 id="study-totals-heading" className="mt-1 text-lg font-semibold">Study time by subject</h2></div>
          <Link href="/tasks" className="text-sm font-medium text-accent hover:underline">View tasks</Link>
        </div>
        {loading ? <p className="mt-4 text-sm text-muted">Loading study history…</p> : studyTotals.length ? <ul className="mt-4 divide-y divide-border">
          {studyTotals.map(([subjectId, total]) => <li key={subjectId} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"><span className="font-medium">{subjectId === "unlinked" ? "Unlinked subject" : subjectById.get(subjectId)?.name ?? "Removed subject"}</span><span className="text-right text-sm text-muted">Today {formatDuration(total.today)} · Total {formatDuration(total.allTime)}</span></li>)}
        </ul> : <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted">Completed focus time will be grouped here by subject.</p>}
      </section>

      <section aria-labelledby="recent-focus-heading" className="mt-5 rounded-3xl border border-border bg-surface p-5 sm:p-6">
        <h2 id="recent-focus-heading" className="text-lg font-semibold">Recent focus sessions</h2>
        {sessions.length ? <ul className="mt-4 divide-y divide-border">
          {sessions.slice(0, 10).map((session) => {
            const task = session.taskId ? taskById.get(session.taskId) : undefined;
            const subject = session.subjectId ? subjectById.get(session.subjectId) : undefined;
            return <li key={session.id} className="flex flex-wrap items-start justify-between gap-2 py-3 first:pt-0 last:pb-0"><div className="min-w-0"><p className="break-words text-sm font-medium">{task?.title ?? "Removed task"}</p><p className="mt-1 text-xs text-muted">{subject?.name ?? "Unlinked subject"} · {new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(session.endedAt))}</p></div><span className="shrink-0 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">{formatDuration(session.durationSeconds)}</span></li>;
          })}
        </ul> : <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted">No focus sessions logged yet.</p>}
      </section>
    </section>
  );
}
