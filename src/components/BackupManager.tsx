"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { importBackupRecords } from "@/lib/db";
import ChoicePicker from "@/components/ChoicePicker";
import { createBackup, MAX_BACKUP_FILE_BYTES, parseBackup } from "@/lib/backup";
import { saveReminderSettings } from "@/lib/reminderSettings";
import type { BackupImportMode } from "@/types/backup";

function countSummary(counts: {
  subjects: number;
  classes: number;
  tasks: number;
  subtasks: number;
  calendarEntries: number;
  habits: number;
  habitCompletions: number;
  routineItems: number;
  routineCompletions: number;
  focusSessions: number;
}) {
  return [
    `${counts.subjects} ${counts.subjects === 1 ? "subject" : "subjects"}`,
    `${counts.classes} ${counts.classes === 1 ? "class" : "classes"}`,
    `${counts.tasks} ${counts.tasks === 1 ? "task" : "tasks"}`,
    `${counts.subtasks} ${counts.subtasks === 1 ? "subtask" : "subtasks"}`,
    `${counts.calendarEntries} ${counts.calendarEntries === 1 ? "exam/event" : "exams/events"}`,
    `${counts.habits} ${counts.habits === 1 ? "habit" : "habits"}`,
    `${counts.habitCompletions} ${counts.habitCompletions === 1 ? "check-in" : "check-ins"}`,
    `${counts.routineItems} ${counts.routineItems === 1 ? "routine step" : "routine steps"}`,
    `${counts.routineCompletions} ${counts.routineCompletions === 1 ? "routine check-in" : "routine check-ins"}`,
    `${counts.focusSessions} ${counts.focusSessions === 1 ? "focus session" : "focus sessions"}`,
  ].join(", ");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The backup could not be processed. Try again.";
}

export default function BackupManager() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<BackupImportMode>("merge");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function exportBackup() {
    setBusy(true);
    setFeedback(null);
    try {
      const backup = await createBackup();
      const file = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `student-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedback({ type: "success", text: `Backup downloaded with ${countSummary({
        subjects: backup.records.subjects.length,
        classes: backup.records.classes.length,
        tasks: backup.records.tasks.length,
        subtasks: backup.records.subtasks.length,
        calendarEntries: backup.records.calendarEntries.length,
        habits: backup.records.habits.length,
        habitCompletions: backup.records.habitCompletions.length,
        routineItems: backup.records.routineItems.length,
        routineCompletions: backup.records.routineCompletions.length,
        focusSessions: backup.records.focusSessions.length,
      })}.` });
    } catch (error) {
      setFeedback({ type: "error", text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    setFeedback(null);

    if (file.size > MAX_BACKUP_FILE_BYTES) {
      setFeedback({ type: "error", text: "This backup is too large to import (limit: 10 MB)." });
      return;
    }

    setBusy(true);
    try {
      const backup = parseBackup(await file.text());
      if (mode === "replace") {
        const accepted = window.confirm("Replace all subjects, classes, tasks, subtasks, exams, events, habits, routines, and focus logs on this device with this backup? This cannot be undone.");
        if (!accepted) return;
      }

      const counts = await importBackupRecords(backup.records, mode);
      if (backup.reminderSettings) saveReminderSettings(backup.reminderSettings);
      const verb = mode === "replace" ? "Restored" : "Imported";
      setFeedback({ type: "success", text: `${verb} ${countSummary(counts)}.` });
    } catch (error) {
      setFeedback({ type: "error", text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="backup-heading" className="mt-8 min-w-0 w-full max-w-full rounded-3xl border border-border bg-surface p-5 sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Keep your data safe</p>
      <h2 id="backup-heading" className="mt-1 text-xl font-semibold">Backup and restore</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted">Save your subjects, classes, tasks, subtasks, exams, events, habits, routines, and focus sessions to a JSON file. Keep a copy somewhere safe in case your device clears its local data.</p>

      <div className="mt-5 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-border p-4">
          <h3 className="font-semibold">Export a backup</h3>
          <p className="mt-1 text-sm leading-6 text-muted">Download a complete copy of the data on this device.</p>
          <button type="button" onClick={() => void exportBackup()} disabled={busy} className="mt-4 min-h-11 w-full min-w-0 whitespace-normal break-words rounded-xl bg-accent px-3 py-2 text-sm font-semibold leading-snug text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60 sm:px-4">{busy ? "Working…" : "Download JSON backup"}</button>
        </div>

        <div className="min-w-0 rounded-2xl border border-border p-4">
          <h3 className="font-semibold">Import a backup</h3>
          <label htmlFor="backup-import-mode" className="mt-3 block text-sm font-medium">Import mode</label>
          <ChoicePicker id="backup-import-mode" value={mode} disabled={busy} options={[{ value: "merge", label: "Merge with this device", marker: "+", color: "#347FAE", description: "Keep current items and add backup data" }, { value: "replace", label: "Replace all device data", marker: "↻", color: "#D85880", description: "Use only the data in this backup" }]} onChange={(value) => setMode(value as BackupImportMode)} />
          <p className="mt-2 min-h-12 text-xs leading-5 text-muted">{mode === "merge" ? "Matching IDs are updated; other current items are kept." : "All current items are replaced by the backup after confirmation."}</p>
          <input ref={inputRef} type="file" accept=".json,application/json" onChange={(event) => void importBackup(event)} className="sr-only" />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="mt-2 min-h-11 w-full min-w-0 whitespace-normal break-words rounded-xl border border-border px-3 py-2 text-sm font-semibold leading-snug transition-colors hover:bg-background disabled:cursor-wait disabled:opacity-60 sm:px-4">{busy ? "Working…" : "Choose backup file"}</button>
        </div>
      </div>

      {feedback && <p role={feedback.type === "error" ? "alert" : "status"} className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium ${feedback.type === "error" ? "bg-red-500/5 text-red-700 dark:text-red-300" : "bg-accent/10 text-foreground"}`}>{feedback.text}</p>}
    </section>
  );
}
