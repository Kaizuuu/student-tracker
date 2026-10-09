"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { addRecord } from "@/lib/db";
import DateTimePicker from "@/components/DateTimePicker";
import ReminderPicker from "@/components/ReminderPicker";
import type { CalendarEntryKind, ReminderMinutesBefore } from "@/types/records";

type QuickAddKind = "task" | CalendarEntryKind;

function localDateTimeValue(value: Date) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString();
  return local.slice(0, 16);
}

function defaultCalendarTime() {
  const nextHour = new Date();
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
  return localDateTimeValue(nextHour);
}

function defaultCalendarDateTime() {
  return defaultCalendarTime();
}

export default function QuickAdd() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeKind, setActiveKind] = useState<QuickAddKind | null>(null);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState<ReminderMinutesBefore>(10);
  const [startsAt, setStartsAt] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (activeKind && !dialog.open) dialog.showModal();
    if (!activeKind && dialog.open) dialog.close();
  }, [activeKind]);

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(""), 4000);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  function openForm(kind: QuickAddKind) {
    setTitle("");
    setDueAt("");
    setReminderMinutesBefore(10);
    setStartsAt(kind === "task" ? "" : defaultCalendarDateTime());
    setLocation("");
    setError("");
    setMenuOpen(false);
    setActiveKind(kind);
  }

  function closeForm() {
    setActiveKind(null);
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const kind = activeKind;
    if (!kind) return;
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Enter a title first.");
      titleRef.current?.focus();
      return;
    }

    if (kind !== "task" && !startsAt) {
      setError("Choose a date and time.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      if (kind === "task") {
        const dueDate = dueAt ? new Date(dueAt) : null;
        if (dueDate && Number.isNaN(dueDate.getTime())) {
          setError("Enter a valid due date and time.");
          setSaving(false);
          return;
        }
        await addRecord("tasks", {
          title: cleanTitle,
          dueAt: dueDate?.toISOString() ?? null,
          reminderMinutesBefore,
          subjectId: null,
          priority: "medium",
          notes: "",
          completedAt: null,
        });
        closeForm();
        setFeedback("Task added.");
      } else {
        const startDate = new Date(startsAt);
        if (Number.isNaN(startDate.getTime())) {
          setError("Enter a valid date and time.");
          setSaving(false);
          return;
        }
        const entryKind: CalendarEntryKind = kind;
        await addRecord("calendarEntries", {
          kind: entryKind,
          title: cleanTitle,
          startsAt: startDate.toISOString(),
          reminderMinutesBefore,
          endsAt: null,
          subjectId: null,
          location: location.trim(),
          notes: "",
        });
        closeForm();
        setFeedback(`${entryKind === "exam" ? "Exam" : "Event"} added.`);
      }
    } catch {
      setError("It could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const itemLabel = activeKind === "exam" ? "exam" : activeKind;

  return (
    <>
      <div className="relative flex h-full flex-col items-center justify-center">
        {menuOpen && (
          <div id="quick-add-options" className="absolute bottom-full left-1/2 z-50 mb-2 w-52 -translate-x-1/2 rounded-2xl border border-border bg-surface p-2 shadow-xl" aria-label="Quick add options">
            <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">Add quickly</p>
            <button type="button" onClick={() => openForm("task")} className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-medium hover:bg-background focus-visible:outline-2 focus-visible:outline-accent">Task</button>
            <button type="button" onClick={() => openForm("exam")} className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-medium hover:bg-background focus-visible:outline-2 focus-visible:outline-accent">Exam</button>
            <button type="button" onClick={() => openForm("event")} className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-medium hover:bg-background focus-visible:outline-2 focus-visible:outline-accent">Event</button>
          </div>
        )}
        <button
          type="button"
          aria-label={menuOpen ? "Close quick add menu" : "Add a task, exam, or event"}
          aria-expanded={menuOpen}
          aria-controls="quick-add-options"
          onClick={() => setMenuOpen((open) => !open)}
          className="z-10 flex size-14 -translate-y-4 items-center justify-center rounded-full border-4 border-surface bg-accent text-accent-foreground shadow-lg shadow-black/15 transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className={`size-6 shrink-0 transition-transform duration-200 ${menuOpen ? "rotate-45" : ""}`}
            fill="none"
          >
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="quick-add-title"
        onCancel={(event) => { event.preventDefault(); closeForm(); }}
        onClick={(event) => { if (event.target === dialogRef.current) closeForm(); }}
        className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl border border-border bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/45"
      >
        {activeKind && (
          <form onSubmit={(event) => void handleSubmit(event)} className="p-5 sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Quick add</p>
                <h2 id="quick-add-title" className="mt-1 text-xl font-semibold">New {itemLabel}</h2>
              </div>
              <button type="button" onClick={closeForm} aria-label="Close quick add" className="flex size-10 shrink-0 items-center justify-center rounded-xl text-xl text-muted hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">×</button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="quick-add-title-input" className="block text-sm font-medium">What do you need to remember?</label>
                <input ref={titleRef} id="quick-add-title-input" autoFocus required maxLength={140} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={activeKind === "task" ? "e.g. Finish lab report" : activeKind === "exam" ? "e.g. Biology final" : "e.g. Science fair"} className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20" />
              </div>

              {activeKind === "task" ? (
                <div>
                  <p className="text-sm font-medium">Due date <span className="font-normal text-muted">(optional)</span></p>
                  <DateTimePicker id="quick-add-due" value={dueAt} onChange={setDueAt} />
                  <div className="mt-4"><ReminderPicker id="quick-add-task-reminder" value={reminderMinutesBefore} disabled={!dueAt} onChange={setReminderMinutesBefore} /></div>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-sm font-medium">Date and time</p>
                    <DateTimePicker id="quick-add-start" required value={startsAt} onChange={setStartsAt} />
                  </div>
                  <ReminderPicker id="quick-add-entry-reminder" value={reminderMinutesBefore} onChange={setReminderMinutesBefore} />
                  <div>
                    <label htmlFor="quick-add-location" className="block text-sm font-medium">Location <span className="font-normal text-muted">(optional)</span></label>
                    <input id="quick-add-location" maxLength={120} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Room or address" className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20" />
                  </div>
                </>
              )}
            </div>

            {error && <p role="alert" className="mt-4 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeForm} className="min-h-11 rounded-xl px-4 text-sm font-medium text-muted hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">Cancel</button>
              <button type="submit" disabled={saving} className="min-h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60">{saving ? "Saving…" : `Save ${itemLabel}`}</button>
            </div>
          </form>
        )}
      </dialog>

      {feedback && <p role="status" className="fixed left-1/2 z-50 -translate-x-1/2 rounded-xl bg-foreground px-4 py-3 text-sm font-medium text-background shadow-lg" style={{ bottom: "calc(5.25rem + env(safe-area-inset-bottom))" }}>{feedback}</p>}
    </>
  );
}
