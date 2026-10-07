"use client";

import { useState, type FormEvent } from "react";
import ChoicePicker from "@/components/ChoicePicker";
import DateTimePicker from "@/components/DateTimePicker";
import { addRecord } from "@/lib/db";
import { parseQuickCapture, type ParsedQuickCapture } from "@/lib/quickCapture";
import type { TaskPriority } from "@/types/records";

function localDateTimeValue(value: Date) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString();
  return local.slice(0, 16);
}

export default function QuickCapture({ onTaskAdded }: { onTaskAdded: () => void }) {
  const [captureText, setCaptureText] = useState("");
  const [draft, setDraft] = useState<ParsedQuickCapture | null>(null);
  const [dueAtInput, setDueAtInput] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function previewCapture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseQuickCapture(captureText);
    if (!parsed.title) {
      setError("Add a task description, like “Math quiz Friday 9am.”");
      setDraft(null);
      return;
    }
    setDraft(parsed);
    setDueAtInput(parsed.dueAt ? localDateTimeValue(new Date(parsed.dueAt)) : "");
    setPriority(parsed.priority);
    setError("");
    setNotice("");
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || saving) return;
    const title = draft.title.trim();
    if (!title) {
      setError("Enter a task title before saving.");
      return;
    }

    const dueDate = dueAtInput ? new Date(dueAtInput) : null;
    if (dueDate && Number.isNaN(dueDate.getTime())) {
      setError("Choose a valid due date and time, or leave it blank.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await addRecord("tasks", {
        title,
        dueAt: dueDate?.toISOString() ?? null,
        subjectId: null,
        priority,
        notes: "",
        completedAt: null,
      });
      setCaptureText("");
      setDraft(null);
      setNotice(`“${title}” added as a task.`);
      onTaskAdded();
    } catch {
      setError("The task could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="quick-capture-heading" className="mt-6 rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Quick capture</p>
      <h2 id="quick-capture-heading" className="mt-1 text-lg font-semibold">Write it the way you’d say it</h2>
      <p className="mt-1 text-sm text-muted">Add a task with a day, time, or priority in one line.</p>

      <form onSubmit={(event) => void previewCapture(event)} className="mt-4">
        <label htmlFor="quick-capture-text" className="sr-only">Describe your task</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input id="quick-capture-text" value={captureText} onChange={(event) => { setCaptureText(event.target.value); setDraft(null); setError(""); }} maxLength={180} placeholder="Math quiz Friday 9am" className="min-h-12 min-w-0 flex-1 rounded-xl border border-border bg-background px-4 text-base outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20" />
          <button type="submit" disabled={!captureText.trim()} className="min-h-12 rounded-xl bg-accent px-5 font-semibold text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50">Preview</button>
        </div>
        <p className="mt-2 text-xs text-muted">Understands today, tomorrow, weekdays, dates like Oct 15, times like 9am or 14:30, and priority high/medium/low.</p>
      </form>

      {draft && <form onSubmit={(event) => void saveTask(event)} className="mt-4 rounded-xl border border-border bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Review your task</h3>
          <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">Task</span>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="quick-capture-title" className="block text-sm font-medium">Task title</label>
            <input id="quick-capture-title" autoFocus maxLength={140} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
          </div>
          <div>
            <p className="text-sm font-medium">Due date and time <span className="font-normal text-muted">(optional)</span></p>
            <DateTimePicker id="quick-capture-due" value={dueAtInput} onChange={setDueAtInput} />
          </div>
          <div>
            <label htmlFor="quick-capture-priority" className="block text-sm font-medium">Priority</label>
            <ChoicePicker id="quick-capture-priority" value={priority} options={[{ value: "low", label: "Low", marker: "↓", color: "#347FAE", description: "Can wait a little" }, { value: "medium", label: "Medium", marker: "•", color: "#D69A29", description: "Keep it on your radar" }, { value: "high", label: "High", marker: "↑", color: "#D85880", description: "Needs attention soon" }]} onChange={(value) => setPriority(value as TaskPriority)} />
          </div>
        </div>
        {error && <p role="alert" className="mt-3 text-sm font-medium text-red-700 dark:text-red-300">{error}</p>}
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => { setDraft(null); setError(""); }} className="min-h-11 rounded-xl px-4 text-sm font-medium text-muted hover:bg-surface">Edit text</button>
          <button type="submit" disabled={saving || !draft.title.trim()} className="min-h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground disabled:cursor-wait disabled:opacity-50">{saving ? "Saving…" : "Save task"}</button>
        </div>
      </form>}

      {error && !draft && <p role="alert" className="mt-3 text-sm font-medium text-red-700 dark:text-red-300">{error}</p>}
      {notice && <p role="status" className="mt-3 rounded-xl bg-accent/10 px-3 py-2 text-sm">{notice}</p>}
    </section>
  );
}
