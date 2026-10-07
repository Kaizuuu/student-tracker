"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { addRecord, deleteRecord, getRecords, updateRecord } from "@/lib/db";
import type { ClassRecord, SubjectRecord } from "@/types/records";

const WEEKDAYS = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 0, label: "Sunday", short: "Sun" },
] as const;

type ClassForm = Omit<ClassRecord, "id" | "createdAt" | "updatedAt" | "subjectId"> & {
  subjectId: string;
};

const EMPTY_FORM: ClassForm = {
  subjectId: "",
  dayOfWeek: 1,
  startTime: "09:00",
  endTime: "10:00",
  room: "",
  teacher: "",
};

function formatTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ClassesManager() {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ClassForm>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [pageError, setPageError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const refreshSchedule = useCallback(async () => {
    try {
      const [nextClasses, nextSubjects] = await Promise.all([
        getRecords("classes"),
        getRecords("subjects"),
      ]);
      setClasses(nextClasses);
      setSubjects(nextSubjects.sort((left, right) => left.name.localeCompare(right.name)));
      setPageError("");
    } catch {
      setPageError("Your local schedule could not be opened. Try refreshing the page.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const currentDay = new Date().getDay();
    setToday(currentDay);
    setSelectedDay(currentDay);
    void refreshSchedule();
  }, [refreshSchedule]);

  const classesForDay = useMemo(
    () => classes
      .filter((classItem) => classItem.dayOfWeek === selectedDay)
      .sort((left, right) => left.startTime.localeCompare(right.startTime)),
    [classes, selectedDay],
  );

  const classCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const classItem of classes) counts[classItem.dayOfWeek] = (counts[classItem.dayOfWeek] ?? 0) + 1;
    return counts;
  }, [classes]);

  function openCreate(day = selectedDay) {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, subjectId: subjects[0]?.id ?? "", dayOfWeek: day });
    setFormError("");
    setNotice("");
    setFormOpen(true);
  }

  function openEdit(classItem: ClassRecord) {
    setEditingId(classItem.id);
    setForm({
      subjectId: classItem.subjectId ?? "",
      dayOfWeek: classItem.dayOfWeek,
      startTime: classItem.startTime,
      endTime: classItem.endTime,
      room: classItem.room,
      teacher: classItem.teacher,
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
    if (!form.subjectId) {
      setFormError("Choose a subject for this class.");
      return;
    }
    if (form.startTime >= form.endTime) {
      setFormError("The end time must be later than the start time.");
      return;
    }

    setSaving(true);
    setFormError("");
    const fields: ClassForm = {
      ...form,
      room: form.room.trim(),
      teacher: form.teacher.trim(),
    };

    try {
      if (editingId) {
        await updateRecord("classes", editingId, fields);
      } else {
        await addRecord("classes", fields);
      }
      setSelectedDay(fields.dayOfWeek);
      closeForm();
      setNotice(editingId ? "Class updated." : "Class added to your weekly schedule.");
      await refreshSchedule();
    } catch {
      setFormError("The class could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(classItem: ClassRecord, subjectName: string) {
    if (!window.confirm(`Remove ${subjectName} from your weekly schedule?`)) return;
    try {
      await deleteRecord("classes", classItem.id);
      setNotice(`${subjectName} removed from your weekly schedule.`);
      await refreshSchedule();
    } catch {
      setPageError("The class could not be removed. Try again.");
    }
  }

  const dayName = WEEKDAYS.find((day) => day.value === selectedDay)?.label ?? "Monday";

  return (
    <section className="mx-auto w-full max-w-3xl">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Your weekly timetable</p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Classes</h1>
          <p className="mt-3 max-w-lg text-base leading-7 text-muted">A clear view of what meets each day, week after week.</p>
        </div>
        {subjects.length > 0 && !formOpen && (
          <button
            type="button"
            onClick={() => openCreate()}
            className="min-h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Add class
          </button>
        )}
      </div>

      {pageError && <p role="alert" className="mt-6 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300">{pageError}</p>}
      {notice && <p role="status" className="mt-6 rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium">{notice}</p>}

      {formOpen && (
        <form onSubmit={handleSubmit} className="mt-8 rounded-3xl border border-border bg-surface p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">{editingId ? "Edit class" : "Add a weekly class"}</h2>
            <button type="button" onClick={closeForm} className="min-h-11 rounded-xl px-3 text-sm font-medium text-muted hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">Cancel</button>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="class-subject" className="block text-sm font-medium">Subject</label>
              <select id="class-subject" required value={form.subjectId} onChange={(event) => setForm({ ...form, subjectId: event.target.value })} className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20">
                <option value="" disabled>Choose a subject</option>
                {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="class-day" className="block text-sm font-medium">Repeats every</label>
              <select id="class-day" value={form.dayOfWeek} onChange={(event) => setForm({ ...form, dayOfWeek: Number(event.target.value) })} className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20">
                {WEEKDAYS.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="class-start" className="block text-sm font-medium">Starts</label>
              <input id="class-start" type="time" required value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
            </div>
            <div>
              <label htmlFor="class-end" className="block text-sm font-medium">Ends</label>
              <input id="class-end" type="time" required value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
            </div>
            <div>
              <label htmlFor="class-room" className="block text-sm font-medium">Room <span className="font-normal text-muted">(optional)</span></label>
              <input id="class-room" maxLength={60} value={form.room} onChange={(event) => setForm({ ...form, room: event.target.value })} placeholder="e.g. Science 204" className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20" />
            </div>
            <div>
              <label htmlFor="class-teacher" className="block text-sm font-medium">Teacher <span className="font-normal text-muted">(optional)</span></label>
              <input id="class-teacher" maxLength={80} value={form.teacher} onChange={(event) => setForm({ ...form, teacher: event.target.value })} placeholder="Teacher name" className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20" />
            </div>
          </div>

          {formError && <p role="alert" className="mt-4 text-sm font-medium text-red-600 dark:text-red-400">{formError}</p>}
          <button type="submit" disabled={saving} className="mt-7 min-h-12 w-full rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60 sm:w-auto sm:min-w-36">
            {saving ? "Saving…" : editingId ? "Save changes" : "Add to schedule"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="mt-8 rounded-2xl border border-border bg-surface px-5 py-6 text-sm text-muted">Loading your weekly schedule…</p>
      ) : subjects.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-border bg-surface px-6 py-10 text-center sm:px-10">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-background text-xl text-accent" aria-hidden="true">▦</span>
          <h2 className="mt-5 text-lg font-semibold">Add a subject first</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">Each class belongs to a subject. Create your subjects, then come back to build your weekly timetable.</p>
          <Link href="/subjects" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Manage subjects</Link>
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-7 gap-1.5 rounded-2xl border border-border bg-surface p-2 sm:gap-2 sm:p-3" aria-label="Choose a day of the week">
            {WEEKDAYS.map((day) => {
              const active = selectedDay === day.value;
              return (
                <button key={day.value} type="button" onClick={() => setSelectedDay(day.value)} aria-label={`${day.label}: ${classCounts[day.value] ?? 0} ${classCounts[day.value] === 1 ? "class" : "classes"}`} aria-pressed={active} className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:min-h-[4.5rem] ${active ? "bg-accent text-accent-foreground" : "text-muted hover:bg-background hover:text-foreground"}`}>
                  <span className="font-semibold">{day.short}</span>
                  <span className={`text-[10px] sm:hidden ${active ? "text-accent-foreground/80" : "text-muted"}`}>{classCounts[day.value] ?? 0}</span>
                  <span className={`hidden text-[10px] sm:block ${active ? "text-accent-foreground/80" : "text-muted"}`}>{classCounts[day.value] ?? 0} {classCounts[day.value] === 1 ? "class" : "classes"}</span>
                  {today === day.value && <span className="sr-only">Today</span>}
                </button>
              );
            })}
          </div>

          <div className="mt-8 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Weekly schedule</p>
              <h2 className="mt-1 text-xl font-semibold">{dayName}</h2>
            </div>
            <p className="text-sm text-muted">{classesForDay.length} {classesForDay.length === 1 ? "class" : "classes"}</p>
          </div>

          {classesForDay.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-border bg-surface px-5 py-8 text-center">
              <p className="font-medium">No classes on {dayName}</p>
              <p className="mt-1 text-sm text-muted">Add a class to start filling in your week.</p>
              {!formOpen && <button type="button" onClick={() => openCreate(selectedDay)} className="mt-4 min-h-11 rounded-xl px-4 text-sm font-semibold text-accent hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent">Add class</button>}
            </div>
          ) : (
            <ol className="mt-4 space-y-3">
              {classesForDay.map((classItem) => {
                const subject = subjects.find((entry) => entry.id === classItem.subjectId);
                const subjectName = subject?.name ?? "Unlinked subject";
                return (
                  <li key={classItem.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 rounded-2xl border border-border bg-surface p-4 sm:flex-nowrap sm:gap-5 sm:p-5">
                    <div className="w-[4.5rem] shrink-0 pt-0.5 text-right">
                      <p className="text-sm font-semibold tabular-nums">{formatTime(classItem.startTime)}</p>
                      <p className="mt-1 text-xs tabular-nums text-muted">{formatTime(classItem.endTime)}</p>
                    </div>
                    <div className="w-1 shrink-0 rounded-full" style={{ backgroundColor: subject?.color ?? "var(--border)" }} aria-hidden="true" />
                    <div className="min-w-0 flex-1 basis-32">
                      <h3 className="break-words font-semibold">{subjectName}</h3>
                      {(classItem.room || classItem.teacher) && (
                        <p className="mt-1.5 whitespace-normal break-words text-sm text-muted">{[classItem.room, classItem.teacher].filter(Boolean).join(" · ")}</p>
                      )}
                    </div>
                    <div className="flex basis-full justify-end gap-1 sm:basis-auto sm:shrink-0 sm:flex-col sm:justify-center sm:gap-0.5 lg:flex-row lg:items-center lg:gap-1">
                      <button type="button" onClick={() => openEdit(classItem)} aria-label={`Edit ${subjectName}`} className="min-h-10 rounded-lg px-2 text-xs font-medium text-muted hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">Edit</button>
                      <button type="button" onClick={() => void handleDelete(classItem, subjectName)} aria-label={`Remove ${subjectName}`} className="min-h-10 rounded-lg px-2 text-xs font-medium text-muted hover:bg-red-500/10 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-red-500 dark:hover:text-red-300">Remove</button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
    </section>
  );
}
