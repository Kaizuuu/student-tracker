"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  addRecord,
  deleteSubject,
  getRecords,
  updateRecord,
} from "@/lib/db";
import type { CalendarEntryRecord, ClassRecord, SubjectRecord, TaskRecord } from "@/types/records";

const COLORS = [
  { name: "Blue", value: "#4D7CFE" },
  { name: "Coral", value: "#E87952" },
  { name: "Violet", value: "#8B6CE5" },
  { name: "Green", value: "#2F9D75" },
  { name: "Amber", value: "#D69A29" },
  { name: "Rose", value: "#D85880" },
] as const;

type SubjectLinks = { classes: number; tasks: number; calendarEntries: number };

const EMPTY_LINKS: SubjectLinks = { classes: 0, tasks: 0, calendarEntries: 0 };

function countSubjectLinks(
  subjects: SubjectRecord[],
  classes: ClassRecord[],
  tasks: TaskRecord[],
  entries: CalendarEntryRecord[],
) {
  const counts: Record<string, SubjectLinks> = {};
  for (const subject of subjects) counts[subject.id] = { ...EMPTY_LINKS };
  for (const record of classes) {
    if (record.subjectId && counts[record.subjectId]) counts[record.subjectId].classes += 1;
  }
  for (const record of tasks) {
    if (record.subjectId && counts[record.subjectId]) counts[record.subjectId].tasks += 1;
  }
  for (const record of entries) {
    if (record.subjectId && counts[record.subjectId]) counts[record.subjectId].calendarEntries += 1;
  }
  return counts;
}

export default function SubjectsManager() {
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [linksBySubject, setLinksBySubject] = useState<Record<string, SubjectLinks>>({});
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(COLORS[0].value);
  const [notes, setNotes] = useState("");
  const [linksText, setLinksText] = useState("");
  const [room, setRoom] = useState("");
  const [teacher, setTeacher] = useState("");
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  const refreshSubjects = useCallback(async () => {
    try {
      const [nextSubjects, classes, tasks, entries] = await Promise.all([
        getRecords("subjects"),
        getRecords("classes"),
        getRecords("tasks"),
        getRecords("calendarEntries"),
      ]);
      setSubjects(nextSubjects.sort((left, right) => left.name.localeCompare(right.name)));
      setLinksBySubject(countSubjectLinks(nextSubjects, classes, tasks, entries));
      setPageError("");
    } catch {
      setPageError("Your local data could not be opened. Try refreshing the page.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSubjects();
  }, [refreshSubjects]);

  function resetForm() {
    setFormOpen(false);
    setEditingId(null);
    setName("");
    setColor(COLORS[0].value);
    setNotes("");
    setLinksText("");
    setRoom("");
    setTeacher("");
    setFormError("");
  }

  function startCreate() {
    setEditingId(null);
    setName("");
    setColor(COLORS[0].value);
    setNotes("");
    setLinksText("");
    setRoom("");
    setTeacher("");
    setFormError("");
    setNotice("");
    setFormOpen(true);
  }

  function startEdit(subject: SubjectRecord) {
    setEditingId(subject.id);
    setName(subject.name);
    setColor(subject.color);
    setNotes(subject.notes ?? "");
    setLinksText((subject.links ?? []).join("\n"));
    setRoom(subject.room ?? "");
    setTeacher(subject.teacher ?? "");
    setFormError("");
    setNotice("");
    setFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setFormError("Enter a subject name.");
      return;
    }
    if (subjects.some((subject) => subject.id !== editingId && subject.name.localeCompare(cleanName, undefined, { sensitivity: "accent" }) === 0)) {
      setFormError("A subject with this name already exists.");
      return;
    }
    const links = linksText.split(/\r?\n/).map((link) => link.trim()).filter(Boolean);
    if (links.length > 15) {
      setFormError("Add up to 15 links per subject.");
      return;
    }
    for (const link of links) {
      try {
        const url = new URL(link);
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
      } catch {
        setFormError("Each link must be a complete http or https URL.");
        return;
      }
    }

    setSaving(true);
    setFormError("");
    const details = { name: cleanName, color, notes: notes.trim(), links, room: room.trim(), teacher: teacher.trim() };
    try {
      if (editingId) {
        await updateRecord("subjects", editingId, details);
      } else {
        await addRecord("subjects", details);
      }
      resetForm();
      setNotice(editingId ? "Subject updated." : "Subject added.");
      await refreshSubjects();
    } catch {
      setFormError("The subject could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(subject: SubjectRecord) {
    const accepted = window.confirm(
      `Remove ${subject.name}? Linked classes, tasks, exams/events, and focus logs will remain, but will no longer be linked to this subject.`,
    );
    if (!accepted) return;

    setNotice("");
    try {
      const summary = await deleteSubject(subject.id);
      await refreshSubjects();
      if (summary) {
        const unlinked = summary.classes + summary.tasks + summary.calendarEntries + summary.focusSessions;
        setNotice(unlinked > 0
          ? `${subject.name} removed. ${unlinked} linked ${unlinked === 1 ? "item was" : "items were"} kept and unlinked.`
          : `${subject.name} removed.`);
      }
    } catch {
      setPageError("The subject could not be removed. Try again.");
    }
  }

  return (
    <section className="mx-auto w-full max-w-2xl">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Your planner</p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Subjects</h1>
          <p className="mt-3 max-w-lg text-base leading-7 text-muted">
            Keep each subject’s room, teacher, notes, and useful links together. Classes, tasks, exams, and events can be connected to it.
          </p>
        </div>
        {!formOpen && (
          <button
            type="button"
            onClick={startCreate}
            className="min-h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Add subject
          </button>
        )}
      </div>

      {formOpen && (
        <form onSubmit={handleSubmit} className="mt-8 rounded-3xl border border-border bg-surface p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">{editingId ? "Edit subject" : "New subject"}</h2>
            <button type="button" onClick={resetForm} className="min-h-11 rounded-xl px-3 text-sm font-medium text-muted hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">
              Cancel
            </button>
          </div>

          <label htmlFor="subject-name" className="mt-5 block text-sm font-medium">Subject name</label>
          <input
            id="subject-name"
            name="name"
            autoFocus
            maxLength={60}
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Biology"
            className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20"
          />

          <fieldset className="mt-6">
            <legend className="text-sm font-medium">Color</legend>
            <div className="mt-3 flex flex-wrap gap-3">
              {COLORS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-label={`${option.name}${color === option.value ? ", selected" : ""}`}
                  aria-pressed={color === option.value}
                  onClick={() => setColor(option.value)}
                  className={`flex size-11 items-center justify-center rounded-full border-2 transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${color === option.value ? "border-foreground" : "border-transparent"}`}
                >
                  <span className="size-7 rounded-full" style={{ backgroundColor: option.value }} />
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="subject-room" className="block text-sm font-medium">Room <span className="font-normal text-muted">(optional)</span></label>
              <input id="subject-room" maxLength={120} value={room} onChange={(event) => setRoom(event.target.value)} placeholder="e.g. Science Lab 2" className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20" />
            </div>
            <div>
              <label htmlFor="subject-teacher" className="block text-sm font-medium">Teacher <span className="font-normal text-muted">(optional)</span></label>
              <input id="subject-teacher" maxLength={120} value={teacher} onChange={(event) => setTeacher(event.target.value)} placeholder="e.g. Ms. Santos" className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20" />
            </div>
          </div>
          <div className="mt-4">
            <label htmlFor="subject-notes" className="block text-sm font-medium">Notes <span className="font-normal text-muted">(optional)</span></label>
            <textarea id="subject-notes" rows={3} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add reminders or details for this subject" className="mt-2 w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20" />
          </div>
          <div className="mt-4">
            <label htmlFor="subject-links" className="block text-sm font-medium">Useful links <span className="font-normal text-muted">(optional, one URL per line)</span></label>
            <textarea id="subject-links" rows={3} maxLength={3000} value={linksText} onChange={(event) => setLinksText(event.target.value)} placeholder="https://classroom.example.com" className="mt-2 w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20" />
            <p className="mt-1 text-xs text-muted">Use complete http or https addresses, up to 15 links.</p>
          </div>

          {formError && <p role="alert" className="mt-4 text-sm font-medium text-red-600 dark:text-red-400">{formError}</p>}
          <button
            type="submit"
            disabled={saving}
            className="mt-7 min-h-12 w-full rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60 sm:w-auto sm:min-w-36"
          >
            {saving ? "Saving…" : editingId ? "Save changes" : "Save subject"}
          </button>
        </form>
      )}

      {notice && <p role="status" className="mt-6 rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-foreground">{notice}</p>}
      {pageError && <p role="alert" className="mt-6 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300">{pageError}</p>}

      <div className="mt-8">
        {loading ? (
          <p className="rounded-2xl border border-border bg-surface px-5 py-6 text-sm text-muted">Loading your subjects…</p>
        ) : subjects.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-surface px-6 py-10 text-center sm:px-10">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-background text-xl text-accent" aria-hidden="true">✳</span>
            <h2 className="mt-5 text-lg font-semibold">Start with a subject</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">Add a subject such as Biology or History. You can connect classes and work to it as you build your planner.</p>
            {!formOpen && <button type="button" onClick={startCreate} className="mt-6 min-h-11 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-background focus-visible:outline-2 focus-visible:outline-accent">Add your first subject</button>}
          </div>
        ) : (
          <ul className="space-y-3" aria-label="Your subjects">
            {subjects.map((subject) => {
              const links = linksBySubject[subject.id] ?? EMPTY_LINKS;
              const linkSummary = [
                links.classes && `${links.classes} ${links.classes === 1 ? "class" : "classes"}`,
                links.tasks && `${links.tasks} ${links.tasks === 1 ? "task" : "tasks"}`,
                links.calendarEntries && `${links.calendarEntries} ${links.calendarEntries === 1 ? "exam or event" : "exams or events"}`,
              ].filter(Boolean).join(" · ");

              return (
            <li key={subject.id} className="flex flex-wrap items-start gap-3 rounded-2xl border border-border bg-surface p-4 sm:gap-4 sm:p-5">
                  <span className="size-3.5 shrink-0 rounded-full" style={{ backgroundColor: subject.color }} aria-hidden="true" />
                  <div className="min-w-0 flex-1 basis-36">
                    <h2 className="break-words font-semibold">{subject.name}</h2>
                    <p className="mt-1 text-xs text-muted">{linkSummary || "No linked items yet"}</p>
                    {(subject.room || subject.teacher) && <p className="mt-2 break-words text-sm text-muted">{[subject.room && `Room ${subject.room}`, subject.teacher && `Teacher ${subject.teacher}`].filter(Boolean).join(" · ")}</p>}
                    {subject.notes && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{subject.notes}</p>}
                    {subject.links && subject.links.length > 0 && <ul className="mt-2 space-y-1" aria-label={`${subject.name} links`}>
                      {subject.links.map((link) => <li key={link}><a href={link} target="_blank" rel="noopener noreferrer" className="break-all text-sm font-medium text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">{link}</a></li>)}
                    </ul>}
                  </div>
                  <div className="flex basis-full items-center justify-end gap-1 sm:basis-auto sm:shrink-0">
                    <button type="button" onClick={() => startEdit(subject)} aria-label={`Edit ${subject.name}`} className="min-h-11 min-w-11 rounded-xl px-3 text-sm font-medium text-muted hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">Edit</button>
                    <button type="button" onClick={() => void handleDelete(subject)} aria-label={`Remove ${subject.name}`} className="min-h-11 min-w-11 rounded-xl px-3 text-sm font-medium text-muted hover:bg-red-500/10 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-red-500 dark:hover:text-red-300">Remove</button>
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
