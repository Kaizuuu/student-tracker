"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { addRecord, deleteRecord, getRecords, updateRecord } from "@/lib/db";
import EntryWizard from "@/components/EntryWizard";
import ChoicePicker from "@/components/ChoicePicker";
import ReminderPicker from "@/components/ReminderPicker";
import ScheduleImageImport from "@/components/ScheduleImageImport";
import TimePicker from "@/components/TimePicker";
import type { ClassRecord, ReminderMinutesBefore, SubjectRecord } from "@/types/records";

const WEEKDAYS = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 0, label: "Sunday", short: "Sun" },
] as const;

type ClassForm = Omit<ClassRecord, "id" | "createdAt" | "updatedAt" | "subjectId" | "reminderMinutesBefore"> & {
  subjectId: string;
  reminderMinutesBefore: ReminderMinutesBefore;
};

const EMPTY_FORM: ClassForm = {
  subjectId: "",
  dayOfWeek: 1,
  startTime: "09:00",
  endTime: "10:00",
  room: "",
  teacher: "",
  reminderMinutesBefore: 10,
};

const CLASS_DAY_OPTIONS = WEEKDAYS.map((day) => ({ value: String(day.value), label: day.label, marker: day.short.slice(0, 1) }));

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
  const [importOpen, setImportOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ClassForm>(EMPTY_FORM);
  const [wizardStep, setWizardStep] = useState(0);
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
    setWizardStep(0);
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
      reminderMinutesBefore: classItem.reminderMinutesBefore === undefined ? 10 : classItem.reminderMinutesBefore,
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
      if (!form.subjectId) {
        setFormError("Choose a subject before continuing.");
        return;
      }
      if (form.startTime >= form.endTime) {
        setFormError("The end time must be later than the start time.");
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

  async function handleImportSave(
    drafts: Array<{ subjectText: string; subjectId: string; dayOfWeek: number | null; startTime: string; endTime: string; room: string; teacher: string }>,
    newSubjectNames: Set<string>,
  ) {
    const subjectByName = new Map(subjects.map((subject) => [subject.name.trim().toLocaleLowerCase(), subject.id]));
    for (const name of newSubjectNames) {
      const cleanName = name.trim();
      const key = cleanName.toLocaleLowerCase();
      if (!cleanName || subjectByName.has(key)) continue;
      const created = await addRecord("subjects", {
        name: cleanName,
        color: "#4D7CFE",
        notes: "",
        links: [],
        room: "",
        teacher: "",
      });
      subjectByName.set(key, created.id);
    }

    for (const draft of drafts) {
      if (draft.dayOfWeek === null) continue;
      const subjectId = draft.subjectId || subjectByName.get(draft.subjectText.trim().toLocaleLowerCase());
      if (!subjectId) continue;
      await addRecord("classes", {
        subjectId,
        dayOfWeek: draft.dayOfWeek,
        startTime: draft.startTime,
        endTime: draft.endTime,
        room: draft.room.trim(),
        teacher: draft.teacher.trim(),
        reminderMinutesBefore: 10,
      });
    }

    setImportOpen(false);
    setSelectedDay(drafts[0]?.dayOfWeek ?? selectedDay);
    setNotice(`${drafts.length} ${drafts.length === 1 ? "class was" : "classes were"} imported into your weekly schedule.`);
    await refreshSchedule();
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
        {!formOpen && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setImportOpen((open) => !open); setNotice(""); }} className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">{importOpen ? "Close import" : "Import screenshot"}</button>
            {subjects.length > 0 && <button type="button" onClick={() => openCreate()} className="min-h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Add class</button>}
          </div>
        )}
      </div>

      {pageError && <p role="alert" className="mt-6 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300">{pageError}</p>}
      {notice && <p role="status" className="mt-6 rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium">{notice}</p>}

      {importOpen && !formOpen && <ScheduleImageImport subjects={subjects} existingClasses={classes} onClose={() => setImportOpen(false)} onSave={handleImportSave} />}

      {formOpen && (
        <form onSubmit={handleWizardSubmit} className="mt-8 rounded-3xl border border-border bg-surface p-5 sm:p-8">
          <EntryWizard
            title={editingId ? "Edit class" : "Add a weekly class"}
            step={wizardStep}
            saving={saving}
            saveLabel={editingId ? "Save changes" : "Add to schedule"}
            error={formError}
            onBack={() => { setFormError(""); setWizardStep((step) => Math.max(step - 1, 0)); }}
            onNext={advanceWizard}
            onCancel={closeForm}
          >
            {wizardStep === 0 && (
              <div className="grid gap-5">
                <div>
                  <label htmlFor="class-subject" className="block text-sm font-medium">Subject</label>
                  <ChoicePicker id="class-subject" value={form.subjectId} placeholder="Choose a subject" options={subjects.map((subject) => ({ value: subject.id, label: subject.name, description: [subject.room, subject.teacher].filter(Boolean).join(" · "), color: subject.color }))} onChange={(subjectId) => setForm({ ...form, subjectId })} />
                </div>
                <div>
                  <label htmlFor="class-day" className="block text-sm font-medium">Repeats every</label>
                  <ChoicePicker id="class-day" value={String(form.dayOfWeek)} options={CLASS_DAY_OPTIONS} onChange={(value) => setForm({ ...form, dayOfWeek: Number(value) })} />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="class-start" className="block text-sm font-medium">Starts</label>
                    <TimePicker id="class-start" value={form.startTime} onChange={(startTime) => setForm({ ...form, startTime })} />
                  </div>
                  <div>
                    <label htmlFor="class-end" className="block text-sm font-medium">Ends</label>
                    <TimePicker id="class-end" value={form.endTime} onChange={(endTime) => setForm({ ...form, endTime })} />
                  </div>
                </div>
                <ReminderPicker id="class-reminder" value={form.reminderMinutesBefore} onChange={(reminderMinutesBefore) => setForm({ ...form, reminderMinutesBefore })} />
              </div>
            )}
            {wizardStep === 1 && (
              <div className="grid gap-5">
                <div>
                  <label htmlFor="class-room" className="block text-sm font-medium">Room <span className="font-normal text-muted">(optional)</span></label>
                  <input id="class-room" maxLength={60} value={form.room} onChange={(event) => setForm({ ...form, room: event.target.value })} placeholder="e.g. Science 204" className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20" />
                </div>
                <div>
                  <label htmlFor="class-teacher" className="block text-sm font-medium">Teacher <span className="font-normal text-muted">(optional)</span></label>
                  <input id="class-teacher" maxLength={80} value={form.teacher} onChange={(event) => setForm({ ...form, teacher: event.target.value })} placeholder="Teacher name" className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20" />
                </div>
              </div>
            )}
            {wizardStep === 2 && (
              <div>
                <p className="text-sm text-muted">Check the weekly schedule before saving.</p>
                <dl className="mt-4 divide-y divide-border rounded-2xl border border-border bg-background px-4">
                  <div className="py-3"><dt className="text-xs font-medium text-muted">Subject</dt><dd className="mt-1 truncate text-sm font-semibold">{subjects.find((subject) => subject.id === form.subjectId)?.name ?? "No subject"}</dd></div>
                  <div className="py-3"><dt className="text-xs font-medium text-muted">Repeats</dt><dd className="mt-1 text-sm">{WEEKDAYS.find((day) => day.value === form.dayOfWeek)?.label ?? "Monday"}, {formatTime(form.startTime)}–{formatTime(form.endTime)}</dd></div>
                  <div className="py-3"><dt className="text-xs font-medium text-muted">Reminder</dt><dd className="mt-1 text-sm">{form.reminderMinutesBefore === null ? "Off" : form.reminderMinutesBefore === 60 ? "1 hour before each class" : `${form.reminderMinutesBefore} minutes before each class`}</dd></div>
                  {(form.room.trim() || form.teacher.trim()) && <div className="py-3"><dt className="text-xs font-medium text-muted">More details</dt><dd className="mt-1 truncate text-sm">{[form.room.trim(), form.teacher.trim()].filter(Boolean).join(" · ")}</dd></div>}
                </dl>
              </div>
            )}
          </EntryWizard>
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
                      <h3 className="truncate font-semibold">{subjectName}</h3>
                      {(classItem.room || classItem.teacher) && (
                        <p className="mt-1.5 truncate text-sm text-muted">{[classItem.room, classItem.teacher].filter(Boolean).join(" · ")}</p>
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
