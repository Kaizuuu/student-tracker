"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { addRecord, deleteRecord, getRecords, updateRecord } from "@/lib/db";
import EntryWizard from "@/components/EntryWizard";
import ChoicePicker from "@/components/ChoicePicker";
import DatePicker from "@/components/DatePicker";
import TimePicker from "@/components/TimePicker";
import ReminderPicker from "@/components/ReminderPicker";
import { dueDateBadgeClasses, dueDateTextClasses, getDueDateTone } from "@/lib/dueDateTone";
import { downloadCalendarItem } from "@/lib/ics";
import { initializeUnmarkedExamReminders, syncExamStudyReminders } from "@/lib/examReminders";
import type { CalendarEntryKind, CalendarEntryRecord, ReminderMinutesBefore, SubjectRecord } from "@/types/records";

type EntryForm = {
  kind: CalendarEntryKind;
  title: string;
  date: string;
  time: string;
  reminderMinutesBefore: ReminderMinutesBefore;
  subjectId: string;
  location: string;
  notes: string;
};

const EMPTY_FORM: EntryForm = {
  kind: "exam",
  title: "",
  date: "",
  time: "09:00",
  reminderMinutesBefore: 10,
  subjectId: "",
  location: "",
  notes: "",
};

function toLocalDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "", time: "09:00" };
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}

function countdownLabel(value: string) {
  const eventDate = parseISO(value);
  const now = new Date();
  const days = differenceInCalendarDays(eventDate, now);
  if (eventDate < now && days === 0) return "Passed today";
  if (days < 0) return `${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} ago`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

function formatEntryDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function kindLabel(kind: CalendarEntryKind) {
  return kind === "exam" ? "Exam" : "Event";
}

export default function CalendarEntriesManager() {
  const [entries, setEntries] = useState<CalendarEntryRecord[]>([]);
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EntryForm>(EMPTY_FORM);
  const [wizardStep, setWizardStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");

  const refreshEntries = useCallback(async () => {
    try {
      const [nextEntries, nextSubjects] = await Promise.all([
        getRecords("calendarEntries"),
        getRecords("subjects"),
      ]);
      await initializeUnmarkedExamReminders(nextEntries);
      setEntries(nextEntries.sort((left, right) => left.startsAt.localeCompare(right.startsAt)));
      setSubjects(nextSubjects.sort((left, right) => left.name.localeCompare(right.name)));
      setPageError("");
    } catch {
      setPageError("Your local calendar could not be opened. Try refreshing the page.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshEntries();
  }, [refreshEntries]);

  const { upcomingEntries, pastEntries } = useMemo(() => {
    const now = Date.now();
    return {
      upcomingEntries: entries.filter((entry) => new Date(entry.startsAt).getTime() >= now),
      pastEntries: entries.filter((entry) => new Date(entry.startsAt).getTime() < now).reverse(),
    };
  }, [entries]);

  function openCreate(kind: CalendarEntryKind = "exam") {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, kind, date: format(new Date(), "yyyy-MM-dd") });
    setWizardStep(0);
    setFormError("");
    setNotice("");
    setFormOpen(true);
  }

  function openEdit(entry: CalendarEntryRecord) {
    const local = toLocalDateTime(entry.startsAt);
    setEditingId(entry.id);
    setForm({
      kind: entry.kind,
      title: entry.title,
      date: local.date,
      time: local.time,
      reminderMinutesBefore: entry.reminderMinutesBefore === undefined ? 10 : entry.reminderMinutesBefore,
      subjectId: entry.subjectId ?? "",
      location: entry.location,
      notes: entry.notes,
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
    if (wizardStep === 0) {
      if (!form.title.trim()) {
        setFormError("Enter a title before continuing.");
        return;
      }
      if (!form.date || !form.time || Number.isNaN(new Date(`${form.date}T${form.time}`).getTime())) {
        setFormError("Choose a valid date and time before continuing.");
        return;
      }
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
    void handleSubmit(event);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) {
      setFormError("Enter a title.");
      return;
    }
    if (!form.date || !form.time) {
      setFormError("Choose a date and time.");
      return;
    }
    const start = new Date(`${form.date}T${form.time}`);
    if (Number.isNaN(start.getTime())) {
      setFormError("Enter a valid date and time.");
      return;
    }

    setSaving(true);
    setFormError("");
    const wasEditing = editingId !== null;
    const fields = {
      kind: form.kind,
      title,
      startsAt: start.toISOString(),
      reminderMinutesBefore: form.reminderMinutesBefore,
      endsAt: null,
      subjectId: form.subjectId || null,
      location: form.location.trim(),
      notes: form.notes.trim(),
    };

    try {
      let savedEntry: CalendarEntryRecord;
      if (editingId) {
        savedEntry = await updateRecord("calendarEntries", editingId, fields);
      } else {
        savedEntry = await addRecord("calendarEntries", fields);
      }
      await syncExamStudyReminders(savedEntry);
      closeForm();
      setNotice(wasEditing
        ? `${kindLabel(form.kind)} updated.${form.kind === "exam" ? " Study prep tasks are set for 7, 3, and 1 days before." : ""}`
        : `${kindLabel(form.kind)} added.${form.kind === "exam" ? " Study prep tasks are set for 7, 3, and 1 days before." : ""}`);
      await refreshEntries();
    } catch {
      setFormError(`The ${form.kind} could not be saved. Try again.`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(entry: CalendarEntryRecord) {
    if (!window.confirm(`Remove “${entry.title}” from your calendar?`)) return;
    try {
      await deleteRecord("calendarEntries", entry.id);
      setNotice(`${kindLabel(entry.kind)} removed.`);
      await refreshEntries();
    } catch {
      setPageError(`The ${entry.kind} could not be removed. Try again.`);
    }
  }

  function renderEntry(entry: CalendarEntryRecord) {
    const subject = subjects.find((item) => item.id === entry.subjectId);
    const countdown = countdownLabel(entry.startsAt);
    const dateTone = getDueDateTone(entry.startsAt, new Date(), true);
    return (
      <li key={entry.id} className="flex flex-wrap items-start gap-x-4 gap-y-3 rounded-2xl border border-border bg-surface p-4 sm:flex-nowrap sm:items-center sm:p-5">
        <span className={`flex min-h-9 items-center rounded-full px-3 text-xs font-semibold ${dueDateBadgeClasses(dateTone)}`}>{countdown}</span>
        <div className="min-w-0 flex-1 basis-40">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="break-words font-semibold">{entry.title}</h3>
            <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">{kindLabel(entry.kind)}</span>
          </div>
          <p className={`mt-1.5 text-sm ${dueDateTextClasses(dateTone)}`}>{formatEntryDate(entry.startsAt)}</p>
          {(entry.location || subject) && (
            <p className="mt-1 break-words text-sm text-muted">{[entry.location, subject?.name].filter(Boolean).join(" · ")}</p>
          )}
          {entry.notes && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-muted">{entry.notes}</p>}
        </div>
        <div className="flex basis-full justify-end gap-1 sm:basis-auto sm:shrink-0">
          <button type="button" onClick={() => openEdit(entry)} aria-label={`Edit ${entry.title}`} className="min-h-10 rounded-lg px-3 text-xs font-medium text-muted hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">Edit</button>
          <button type="button" title="Download a calendar file with 1-day and 1-hour reminders" onClick={() => downloadCalendarItem({ id: entry.id, title: `${kindLabel(entry.kind)}: ${entry.title}`, startsAt: entry.startsAt, endsAt: entry.endsAt, description: entry.notes, location: entry.location })} aria-label={`Add ${entry.title} to Calendar`} className="min-h-10 rounded-lg px-2 text-xs font-medium text-muted hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">Add to Calendar</button>
          <button type="button" onClick={() => void handleDelete(entry)} aria-label={`Remove ${entry.title}`} className="min-h-10 rounded-lg px-3 text-xs font-medium text-muted hover:bg-red-500/10 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-red-500 dark:hover:text-red-300">Remove</button>
        </div>
      </li>
    );
  }

  return (
    <section className="dates-page mx-auto w-full max-w-3xl">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Dates to remember</p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Exams &amp; events</h1>
          <p className="mt-3 max-w-lg text-base leading-7 text-muted">Keep important dates, places, and details together. Exams add study tasks 7, 3, and 1 days before; calendar exports include alerts 1 day and 1 hour before.</p>
        </div>
        {!formOpen && (
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <button type="button" onClick={() => openCreate("exam")} className="min-h-11 flex-1 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:flex-none">Add exam</button>
            <button type="button" onClick={() => openCreate("event")} className="min-h-11 flex-1 rounded-xl border border-border bg-surface px-4 text-sm font-semibold transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:flex-none">Add event</button>
          </div>
        )}
      </div>

      {pageError && <p role="alert" className="mt-6 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300">{pageError}</p>}
      {notice && <p role="status" className="mt-6 rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium">{notice}</p>}

      {formOpen && (
        <form onSubmit={handleWizardSubmit} className="mt-8 min-w-0 w-full max-w-full rounded-3xl border border-border bg-surface p-5 sm:p-8">
          <EntryWizard
            title={editingId ? `Edit ${form.kind}` : `Add an ${form.kind === "exam" ? "exam" : "event"}`}
            step={wizardStep}
            saving={saving}
            saveLabel={editingId ? "Save changes" : "Save date"}
            error={formError}
            onBack={() => { setFormError(""); setWizardStep((step) => Math.max(step - 1, 0)); }}
            onNext={advanceWizard}
            onCancel={closeForm}
          >
            {wizardStep === 0 && (
              <div className="grid min-w-0 gap-5">
                <div>
                  <label htmlFor="entry-kind" className="block text-sm font-medium">What are you adding?</label>
                  <ChoicePicker id="entry-kind" value={form.kind} options={[{ value: "exam", label: "Exam", marker: "E", color: "#DB6B70", description: "Test, quiz, or assessment" }, { value: "event", label: "Event", marker: "✦", color: "#347FAE", description: "A date to remember" }]} onChange={(kind) => setForm({ ...form, kind: kind as CalendarEntryKind })} />
                </div>
                <div>
                  <label htmlFor="entry-title" className="block text-sm font-medium">Title</label>
                  <input id="entry-title" autoFocus required maxLength={140} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder={form.kind === "exam" ? "e.g. Biology final" : "e.g. Science fair"} className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20" />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="entry-date" className="block text-sm font-medium">Date</label>
                    <DatePicker id="entry-date" required value={form.date} onChange={(date) => setForm({ ...form, date })} />
                  </div>
                  <div>
                    <label htmlFor="entry-time" className="block text-sm font-medium">Time</label>
                    <TimePicker id="entry-time" value={form.time} onChange={(time) => setForm({ ...form, time })} />
                  </div>
                </div>
                <ReminderPicker id="entry-reminder" value={form.reminderMinutesBefore} onChange={(reminderMinutesBefore) => setForm({ ...form, reminderMinutesBefore })} />
              </div>
            )}
            {wizardStep === 1 && (
              <div className="grid min-w-0 gap-5">
                <div>
                  <label htmlFor="entry-location" className="block text-sm font-medium">Location <span className="font-normal text-muted">(optional)</span></label>
                  <input id="entry-location" maxLength={120} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Room or address" className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20" />
                </div>
                <div>
                  <label htmlFor="entry-subject" className="block text-sm font-medium">Subject <span className="font-normal text-muted">(optional)</span></label>
                  <ChoicePicker id="entry-subject" value={form.subjectId} options={[{ value: "", label: "No subject", marker: "—", description: "Keep this item unlinked" }, ...subjects.map((subject) => ({ value: subject.id, label: subject.name, description: [subject.room, subject.teacher].filter(Boolean).join(" · "), color: subject.color }))]} onChange={(subjectId) => setForm({ ...form, subjectId })} />
                </div>
                <div>
                  <label htmlFor="entry-notes" className="block text-sm font-medium">Notes <span className="font-normal text-muted">(optional)</span></label>
                  <textarea id="entry-notes" rows={3} maxLength={2000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Add details to remember" className="mt-2 w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20" />
                </div>
              </div>
            )}
            {wizardStep === 2 && (
              <div>
                <p className="text-sm text-muted">Check the date before saving.</p>
                <dl className="mt-4 divide-y divide-border rounded-2xl border border-border bg-background px-4">
                  <div className="py-3"><dt className="text-xs font-medium text-muted">Type and title</dt><dd className="mt-1 break-words text-sm font-semibold">{form.kind === "exam" ? "Exam" : "Event"} · {form.title.trim() || "Untitled"}</dd></div>
                  <div className="py-3"><dt className="text-xs font-medium text-muted">When</dt><dd className="mt-1 text-sm">{form.date && form.time ? format(new Date(`${form.date}T${form.time}`), "EEEE, MMMM d 'at' h:mm a") : "Choose a date and time"}</dd></div>
                  <div className="py-3"><dt className="text-xs font-medium text-muted">Reminder</dt><dd className="mt-1 text-sm">{form.reminderMinutesBefore === null ? "Off" : `1 day and ${form.reminderMinutesBefore === 1440 ? "10 minutes" : form.reminderMinutesBefore === 60 ? "1 hour" : `${form.reminderMinutesBefore} minutes`} before`}</dd></div>
                  {(form.location.trim() || form.subjectId) && <div className="py-3"><dt className="text-xs font-medium text-muted">Details</dt><dd className="mt-1 break-words text-sm">{[form.location.trim(), subjects.find((subject) => subject.id === form.subjectId)?.name].filter(Boolean).join(" · ")}</dd></div>}
                  {form.notes.trim() && <div className="py-3"><dt className="text-xs font-medium text-muted">Notes</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{form.notes.trim()}</dd></div>}
                </dl>
              </div>
            )}
          </EntryWizard>
        </form>
      )}

      {loading ? (
        <p className="mt-8 rounded-2xl border border-border bg-surface px-5 py-6 text-sm text-muted">Loading your exams and events…</p>
      ) : entries.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-border bg-surface px-6 py-10 text-center sm:px-10">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-background text-xl text-accent" aria-hidden="true">◷</span>
          <h2 className="mt-5 text-lg font-semibold">Your calendar is clear</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">Add an exam or event to see its date and countdown here.</p>
        </div>
      ) : (
        <div className="dates-groups mt-8 space-y-8">
          <section aria-labelledby="upcoming-heading">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="upcoming-heading" className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Upcoming</h2>
              <span className="text-sm text-muted">{upcomingEntries.length} {upcomingEntries.length === 1 ? "date" : "dates"}</span>
            </div>
            {upcomingEntries.length ? <ol className="space-y-3">{upcomingEntries.map(renderEntry)}</ol> : <p className="rounded-2xl border border-border bg-surface px-5 py-6 text-sm text-muted">Nothing upcoming. Add an exam or event when you have a date to remember.</p>}
          </section>
          {pastEntries.length > 0 && (
            <section aria-labelledby="past-heading">
              <h2 id="past-heading" className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted">Past</h2>
              <ol className="space-y-3">{pastEntries.map(renderEntry)}</ol>
            </section>
          )}
        </div>
      )}
    </section>
  );
}
