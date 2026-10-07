"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { addRecord, deleteRecord, getRecords, updateRecord } from "@/lib/db";
import { dueDateBadgeClasses, dueDateTextClasses, getDueDateTone } from "@/lib/dueDateTone";
import { downloadCalendarItem } from "@/lib/ics";
import type { CalendarEntryKind, CalendarEntryRecord, SubjectRecord } from "@/types/records";

type EntryForm = {
  kind: CalendarEntryKind;
  title: string;
  date: string;
  time: string;
  subjectId: string;
  location: string;
  notes: string;
};

const EMPTY_FORM: EntryForm = {
  kind: "exam",
  title: "",
  date: "",
  time: "09:00",
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
      subjectId: entry.subjectId ?? "",
      location: entry.location,
      notes: entry.notes,
    });
    setFormError("");
    setNotice("");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setFormError("");
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
      endsAt: null,
      subjectId: form.subjectId || null,
      location: form.location.trim(),
      notes: form.notes.trim(),
    };

    try {
      if (editingId) {
        await updateRecord("calendarEntries", editingId, fields);
      } else {
        await addRecord("calendarEntries", fields);
      }
      closeForm();
      setNotice(wasEditing ? `${kindLabel(form.kind)} updated.` : `${kindLabel(form.kind)} added.`);
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
    <section className="mx-auto w-full max-w-3xl">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Dates to remember</p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Exams &amp; events</h1>
          <p className="mt-3 max-w-lg text-base leading-7 text-muted">Keep important dates, places, and details together. Export a date with reminders 1 day and 1 hour before.</p>
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
        <form onSubmit={handleSubmit} className="mt-8 rounded-3xl border border-border bg-surface p-5 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">{editingId ? `Edit ${form.kind}` : `Add an ${form.kind === "exam" ? "exam" : "event"}`}</h2>
            <button type="button" onClick={closeForm} className="min-h-11 rounded-xl px-3 text-sm font-medium text-muted hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">Cancel</button>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="entry-kind" className="block text-sm font-medium">Type</label>
              <select id="entry-kind" value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as CalendarEntryKind })} className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20">
                <option value="exam">Exam</option>
                <option value="event">Event</option>
              </select>
            </div>
            <div>
              <label htmlFor="entry-title" className="block text-sm font-medium">Title</label>
              <input id="entry-title" required maxLength={140} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder={form.kind === "exam" ? "e.g. Biology final" : "e.g. Science fair"} className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20" />
            </div>
            <div>
              <label htmlFor="entry-date" className="block text-sm font-medium">Date</label>
              <input id="entry-date" type="date" required value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
            </div>
            <div>
              <label htmlFor="entry-time" className="block text-sm font-medium">Time</label>
              <input id="entry-time" type="time" required value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
            </div>
            <div>
              <label htmlFor="entry-location" className="block text-sm font-medium">Location <span className="font-normal text-muted">(optional)</span></label>
              <input id="entry-location" maxLength={120} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Room or address" className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20" />
            </div>
            <div>
              <label htmlFor="entry-subject" className="block text-sm font-medium">Subject <span className="font-normal text-muted">(optional)</span></label>
              <select id="entry-subject" value={form.subjectId} onChange={(event) => setForm({ ...form, subjectId: event.target.value })} className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20">
                <option value="">No subject</option>
                {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="entry-notes" className="block text-sm font-medium">Notes <span className="font-normal text-muted">(optional)</span></label>
              <textarea id="entry-notes" rows={3} maxLength={2000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Add details to remember" className="mt-2 w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20" />
            </div>
          </div>

          {formError && <p role="alert" className="mt-4 text-sm font-medium text-red-600 dark:text-red-400">{formError}</p>}
          <button type="submit" disabled={saving} className="mt-7 min-h-12 w-full rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60 sm:w-auto sm:min-w-36">{saving ? "Saving…" : editingId ? "Save changes" : "Save date"}</button>
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
        <div className="mt-8 space-y-8">
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
