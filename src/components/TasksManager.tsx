"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { addRecord, deleteRecord, deleteTask, getRecords, updateRecord } from "@/lib/db";
import EntryWizard from "@/components/EntryWizard";
import ChoicePicker from "@/components/ChoicePicker";
import DateTimePicker from "@/components/DateTimePicker";
import ReminderPicker from "@/components/ReminderPicker";
import { dueDateTextClasses, getDueDateTone } from "@/lib/dueDateTone";
import { downloadCalendarItem } from "@/lib/ics";
import type { ReminderMinutesBefore, SubtaskRecord, SubjectRecord, TaskPriority, TaskRecord } from "@/types/records";

type TaskFilter = "all" | "open" | "completed";

type TaskForm = {
  title: string;
  dueAt: string;
  reminderMinutesBefore: ReminderMinutesBefore;
  subjectId: string;
  priority: TaskPriority;
  notes: string;
};

const EMPTY_FORM: TaskForm = {
  title: "",
  dueAt: "",
  reminderMinutesBefore: 10,
  subjectId: "",
  priority: "medium",
  notes: "",
};

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

function toLocalInputValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function formatDueAt(value: string | null) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function priorityClasses(priority: TaskPriority) {
  switch (priority) {
    case "high":
      return "bg-red-500/10 text-red-700 dark:text-red-300";
    case "medium":
      return "bg-amber-500/10 text-amber-800 dark:text-amber-300";
    case "low":
      return "bg-background text-muted";
  }
}

export default function TasksManager() {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [subtasks, setSubtasks] = useState<SubtaskRecord[]>([]);
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM);
  const [wizardStep, setWizardStep] = useState(0);
  const [formError, setFormError] = useState("");
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [subtaskDrafts, setSubtaskDrafts] = useState<Record<string, string>>({});

  const refreshTasks = useCallback(async () => {
    try {
      const [nextTasks, nextSubtasks, nextSubjects] = await Promise.all([
        getRecords("tasks"),
        getRecords("subtasks"),
        getRecords("subjects"),
      ]);
      setTasks(nextTasks);
      setSubtasks(nextSubtasks);
      setSubjects(nextSubjects);
      setPageError("");
    } catch {
      setPageError("Your local tasks could not be opened. Try refreshing the page.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshTasks();
  }, [refreshTasks]);

  const filterCounts = useMemo(() => ({
    all: tasks.length,
    open: tasks.filter((task) => !task.completedAt).length,
    completed: tasks.filter((task) => Boolean(task.completedAt)).length,
  }), [tasks]);

  const visibleTasks = useMemo(() => tasks
    .filter((task) => filter === "all" || (filter === "completed" ? Boolean(task.completedAt) : !task.completedAt))
    .sort((left, right) => {
      if (Boolean(left.completedAt) !== Boolean(right.completedAt)) return left.completedAt ? 1 : -1;
      if (!left.dueAt) return right.dueAt ? 1 : 0;
      if (!right.dueAt) return -1;
      return left.dueAt.localeCompare(right.dueAt);
    }), [tasks, filter]);

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setWizardStep(0);
    setFormError("");
    setNotice("");
    setFormOpen(true);
  }

  function startEdit(task: TaskRecord) {
    setEditingId(task.id);
    setForm({
      title: task.title,
      dueAt: toLocalInputValue(task.dueAt),
      reminderMinutesBefore: task.reminderMinutesBefore === undefined ? 10 : task.reminderMinutesBefore,
      subjectId: task.subjectId ?? "",
      priority: task.priority,
      notes: task.notes,
    });
    setWizardStep(0);
    setFormError("");
    setNotice("");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setWizardStep(0);
    setFormError("");
  }

  function advanceWizard() {
    if (wizardStep === 0 && !form.title.trim()) {
      setFormError("Enter a task title before continuing.");
      return;
    }
    setFormError("");
    setWizardStep((step) => Math.min(step + 1, 2));
  }

  function handleWizardSubmit(event: FormEvent<HTMLFormElement>) {
    if (wizardStep < 2) {
      event.preventDefault();
      advanceWizard();
      return;
    }
    void handleTaskSubmit(event);
  }

  async function handleTaskSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) {
      setFormError("Enter a task title.");
      return;
    }

    setSaving(true);
    setFormError("");
    const wasEditing = editingId !== null;
    const dueAt = form.dueAt ? new Date(form.dueAt) : null;
    if (dueAt && Number.isNaN(dueAt.getTime())) {
      setFormError("Enter a valid due date and time.");
      setSaving(false);
      return;
    }
    const fields = {
      title,
      dueAt: dueAt ? dueAt.toISOString() : null,
      reminderMinutesBefore: form.reminderMinutesBefore,
      subjectId: form.subjectId || null,
      priority: form.priority,
      notes: form.notes.trim(),
    };

    try {
      if (editingId) {
        await updateRecord("tasks", editingId, fields);
      } else {
        await addRecord("tasks", { ...fields, completedAt: null });
      }
      closeForm();
      setNotice(wasEditing ? "Task updated." : "Task added.");
      await refreshTasks();
    } catch {
      setFormError("The task could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleTask(task: TaskRecord) {
    try {
      await updateRecord("tasks", task.id, { completedAt: task.completedAt ? null : new Date().toISOString() });
      setNotice(task.completedAt ? "Task marked as open." : "Task completed.");
      await refreshTasks();
    } catch {
      setPageError("The task status could not be changed. Try again.");
    }
  }

  async function removeTask(task: TaskRecord) {
    if (!window.confirm("Remove “" + task.title + "” and its subtasks?")) return;
    try {
      await deleteTask(task.id);
      setNotice("Task and its subtasks removed.");
      await refreshTasks();
    } catch {
      setPageError("The task could not be removed. Try again.");
    }
  }

  async function handleSubtaskSubmit(event: FormEvent<HTMLFormElement>, taskId: string) {
    event.preventDefault();
    const title = (subtaskDrafts[taskId] ?? "").trim();
    if (!title) return;
    const position = Math.max(-1, ...subtasks.filter((subtask) => subtask.taskId === taskId).map((subtask) => subtask.position)) + 1;
    try {
      await addRecord("subtasks", { taskId, title, position, completedAt: null });
      setSubtaskDrafts((current) => ({ ...current, [taskId]: "" }));
      await refreshTasks();
    } catch {
      setPageError("The step could not be added. Try again.");
    }
  }

  async function toggleSubtask(subtask: SubtaskRecord) {
    try {
      await updateRecord("subtasks", subtask.id, { completedAt: subtask.completedAt ? null : new Date().toISOString() });
      await refreshTasks();
    } catch {
      setPageError("The step could not be updated. Try again.");
    }
  }

  async function removeSubtask(subtask: SubtaskRecord) {
    try {
      await deleteRecord("subtasks", subtask.id);
      await refreshTasks();
    } catch {
      setPageError("The step could not be removed. Try again.");
    }
  }

  return (
    <section className="mx-auto w-full max-w-3xl">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Your work, in one place</p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Tasks</h1>
          <p className="mt-3 max-w-lg text-base leading-7 text-muted">Keep the next step clear, and make progress a little at a time.</p>
        </div>
        {!formOpen && (
          <button type="button" onClick={startCreate} className="min-h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Add task</button>
        )}
      </div>

      {pageError && <p role="alert" className="mt-6 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300">{pageError}</p>}
      {notice && <p role="status" className="mt-6 rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium">{notice}</p>}

      {formOpen && (
        <form onSubmit={handleWizardSubmit} className="mt-8 rounded-3xl border border-border bg-surface p-5 sm:p-8">
          <EntryWizard
            title={editingId ? "Edit task" : "New task"}
            step={wizardStep}
            saving={saving}
            saveLabel={editingId ? "Save changes" : "Save task"}
            error={formError}
            onBack={() => { setFormError(""); setWizardStep((step) => Math.max(step - 1, 0)); }}
            onNext={advanceWizard}
            onCancel={closeForm}
          >
            {wizardStep === 0 && (
              <div className="grid gap-5">
                <div>
                  <label htmlFor="task-title" className="block text-sm font-medium">What do you need to do?</label>
                  <input id="task-title" autoFocus required maxLength={140} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Finish biology lab report" className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20" />
                </div>
                <div>
                  <p className="text-sm font-medium">When is it due? <span className="font-normal text-muted">(optional)</span></p>
                  <DateTimePicker id="task-due" value={form.dueAt} onChange={(dueAt) => setForm({ ...form, dueAt })} />
                </div>
                <ReminderPicker id="task-reminder" value={form.reminderMinutesBefore} disabled={!form.dueAt} onChange={(reminderMinutesBefore) => setForm({ ...form, reminderMinutesBefore })} />
              </div>
            )}
            {wizardStep === 1 && (
              <div className="grid gap-5">
                <div>
                  <label htmlFor="task-subject" className="block text-sm font-medium">Subject <span className="font-normal text-muted">(optional)</span></label>
                  <ChoicePicker id="task-subject" value={form.subjectId} options={[{ value: "", label: "No subject", marker: "—", description: "Keep this task unlinked" }, ...subjects.map((subject) => ({ value: subject.id, label: subject.name, description: [subject.room, subject.teacher].filter(Boolean).join(" · "), color: subject.color }))]} onChange={(subjectId) => setForm({ ...form, subjectId })} />
                  {subjects.length === 0 && <Link href="/subjects" className="mt-2 inline-block text-xs font-medium text-accent underline decoration-accent/40 underline-offset-2">Add subjects</Link>}
                </div>
                <fieldset>
                  <legend className="text-sm font-medium">Priority</legend>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {PRIORITIES.map((priority) => (
                      <button key={priority.value} type="button" aria-pressed={form.priority === priority.value} onClick={() => setForm({ ...form, priority: priority.value })} className={"min-h-11 rounded-xl border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " + (form.priority === priority.value ? "border-accent bg-accent/10 text-foreground" : "border-border text-muted hover:bg-background")}>
                        {priority.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <div>
                  <label htmlFor="task-notes" className="block text-sm font-medium">Notes <span className="font-normal text-muted">(optional)</span></label>
                  <textarea id="task-notes" rows={3} maxLength={2000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Add any details that will help you get started" className="mt-2 w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20" />
                </div>
              </div>
            )}
            {wizardStep === 2 && (
              <div>
                <p className="text-sm text-muted">Check the details before saving.</p>
                <dl className="mt-4 divide-y divide-border rounded-2xl border border-border bg-background px-4">
                  <div className="py-3"><dt className="text-xs font-medium text-muted">Task</dt><dd className="mt-1 break-words text-sm font-semibold">{form.title.trim() || "Untitled task"}</dd></div>
                  <div className="py-3"><dt className="text-xs font-medium text-muted">Due</dt><dd className="mt-1 text-sm">{form.dueAt ? new Date(form.dueAt).toLocaleString() : "No due date"}</dd></div>
                  <div className="py-3"><dt className="text-xs font-medium text-muted">Reminder</dt><dd className="mt-1 text-sm">{form.reminderMinutesBefore === null ? "Off" : form.reminderMinutesBefore === 1440 ? "1 day before" : form.reminderMinutesBefore === 60 ? "1 hour before" : `${form.reminderMinutesBefore} minutes before`}</dd></div>
                  <div className="py-3"><dt className="text-xs font-medium text-muted">Subject and priority</dt><dd className="mt-1 text-sm">{subjects.find((subject) => subject.id === form.subjectId)?.name ?? "No subject"} · {form.priority}</dd></div>
                  {form.notes.trim() && <div className="py-3"><dt className="text-xs font-medium text-muted">Notes</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{form.notes.trim()}</dd></div>}
                </dl>
              </div>
            )}
          </EntryWizard>
        </form>
      )}

      <div className="mt-8 flex gap-1 rounded-2xl border border-border bg-surface p-1" role="group" aria-label="Filter tasks">
        {(["all", "open", "completed"] as TaskFilter[]).map((option) => (
          <button key={option} type="button" aria-pressed={filter === option} onClick={() => setFilter(option)} className={"min-h-11 flex-1 rounded-xl px-2 text-xs font-medium capitalize transition-colors sm:text-sm " + (filter === option ? "bg-background text-foreground shadow-sm" : "text-muted hover:text-foreground")}>
            {option === "open" ? "To do" : option} <span className="ml-1 text-muted">{filterCounts[option]}</span>
          </button>
        ))}
      </div>

      <div className="mt-5">
        {loading ? (
          <p className="rounded-2xl border border-border bg-surface px-5 py-6 text-sm text-muted">Loading your tasks…</p>
        ) : visibleTasks.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-surface px-6 py-10 text-center sm:px-10">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-background text-xl text-accent" aria-hidden="true">✓</span>
            <h2 className="mt-5 text-lg font-semibold">{filter === "completed" ? "Nothing completed yet" : filter === "open" ? "You’re all caught up" : "Start with one task"}</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">{filter === "completed" ? "Finished tasks will be collected here." : filter === "open" ? "New tasks you add will appear here." : "Add an assignment, reminder, or any next step you want to remember."}</p>
            {filter !== "completed" && !formOpen && <button type="button" onClick={startCreate} className="mt-6 min-h-11 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-background focus-visible:outline-2 focus-visible:outline-accent">Add your first task</button>}
          </div>
        ) : (
          <ul className="space-y-4" aria-label="Tasks">
            {visibleTasks.map((task) => {
              const subject = subjects.find((item) => item.id === task.subjectId);
              const taskSteps = subtasks.filter((item) => item.taskId === task.id).sort((left, right) => left.position - right.position);
              const completedSteps = taskSteps.filter((step) => Boolean(step.completedAt)).length;
              const progress = taskSteps.length ? Math.round((completedSteps / taskSteps.length) * 100) : 0;

              return (
                <li key={task.id} className={"rounded-3xl border border-border bg-surface p-5 sm:p-6 " + (task.completedAt ? "opacity-75" : "")}>
                  <div className="flex flex-wrap items-start gap-x-3 gap-y-2 sm:flex-nowrap">
                    <button type="button" onClick={() => void toggleTask(task)} aria-label={(task.completedAt ? "Mark " + task.title + " as open" : "Complete " + task.title)} aria-pressed={Boolean(task.completedAt)} className={"mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " + (task.completedAt ? "border-accent bg-accent text-accent-foreground" : "border-border text-transparent hover:border-accent")}>
                      <span aria-hidden="true" className="text-xs font-bold">✓</span>
                    </button>
                    <div className="min-w-0 flex-1 basis-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className={"break-words font-semibold " + (task.completedAt ? "text-muted line-through" : "")}>{task.title}</h2>
                        <span className={"rounded-full px-2.5 py-1 text-[11px] font-semibold " + priorityClasses(task.priority)}>{task.priority} priority</span>
                        {task.examReminderForId && <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent">Exam prep</span>}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span className={dueDateTextClasses(task.completedAt ? "none" : getDueDateTone(task.dueAt))}>{formatDueAt(task.dueAt)}</span>
                        {subject && <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ backgroundColor: subject.color }} aria-hidden="true" />{subject.name}</span>}
                      </div>
                      {task.notes && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-muted">{task.notes}</p>}
                    </div>
                    <div className="flex basis-full justify-end gap-1 sm:basis-auto sm:shrink-0">
                      <button type="button" onClick={() => startEdit(task)} aria-label={"Edit " + task.title} className="min-h-10 rounded-lg px-2 text-xs font-medium text-muted hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">Edit</button>
                      <button
                        type="button"
                        disabled={!task.dueAt}
                        title={task.dueAt ? "Download a calendar file with 1-day and 1-hour reminders" : "Add a due date before exporting this task"}
                        onClick={() => task.dueAt && downloadCalendarItem({ id: task.id, title: task.title, startsAt: task.dueAt, description: task.notes })}
                        aria-label={`Add ${task.title} to Calendar`}
                        className="min-h-10 rounded-lg px-2 text-xs font-medium text-muted hover:bg-background hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        Add to Calendar
                      </button>
                      <button type="button" onClick={() => void removeTask(task)} aria-label={"Remove " + task.title} className="min-h-10 rounded-lg px-2 text-xs font-medium text-muted hover:bg-red-500/10 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-red-500 dark:hover:text-red-300">Remove</button>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-border pt-4">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium">Progress</span>
                      <span className="text-muted">{taskSteps.length ? completedSteps + " of " + taskSteps.length + " steps · " + progress + "%" : "No steps yet · 0%"}</span>
                    </div>
                    <div role="progressbar" aria-label={task.title + " subtask progress"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={taskSteps.length ? completedSteps + " of " + taskSteps.length + " steps complete" : "No subtasks yet"} className="mt-2 h-2 overflow-hidden rounded-full bg-background">
                      <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: progress + "%" }} />
                    </div>

                    {taskSteps.length > 0 && (
                      <ul className="mt-3 divide-y divide-border">
                        {taskSteps.map((step) => (
                          <li key={step.id} className="flex min-h-11 items-center gap-3 py-1">
                            <input type="checkbox" checked={Boolean(step.completedAt)} onChange={() => void toggleSubtask(step)} aria-label={(step.completedAt ? "Reopen" : "Complete") + " step: " + step.title} className="size-5 shrink-0 accent-[var(--accent)]" />
                            <span className={"min-w-0 flex-1 text-sm " + (step.completedAt ? "text-muted line-through" : "")}>{step.title}</span>
                            <button type="button" onClick={() => void removeSubtask(step)} aria-label={"Remove step: " + step.title} className="flex size-10 shrink-0 items-center justify-center rounded-lg text-lg text-muted hover:bg-background hover:text-red-600 focus-visible:outline-2 focus-visible:outline-accent">×</button>
                          </li>
                        ))}
                      </ul>
                    )}

                    <form onSubmit={(event) => void handleSubtaskSubmit(event, task.id)} className="mt-3 flex gap-2">
                      <label htmlFor={"subtask-" + task.id} className="sr-only">Add a step to {task.title}</label>
                      <input id={"subtask-" + task.id} maxLength={120} value={subtaskDrafts[task.id] ?? ""} onChange={(event) => setSubtaskDrafts((current) => ({ ...current, [task.id]: event.target.value }))} placeholder="Add a step" className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20" />
                      <button type="submit" disabled={!subtaskDrafts[task.id]?.trim()} className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold text-foreground hover:bg-background disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent">Add step</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
