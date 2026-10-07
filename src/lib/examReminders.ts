import { startOfDay } from "date-fns";
import { addRecord, getRecords, updateRecord } from "@/lib/db";
import type { CalendarEntryRecord } from "@/types/records";

const REMINDER_OFFSETS = [7, 3, 1] as const;

function reminderDate(exam: CalendarEntryRecord, daysBefore: 1 | 3 | 7) {
  const startsAt = new Date(exam.startsAt);
  return new Date(
    startsAt.getFullYear(),
    startsAt.getMonth(),
    startsAt.getDate() - daysBefore,
    startsAt.getHours(),
    startsAt.getMinutes(),
  );
}

/** Creates exam prep tasks once, and keeps still-upcoming generated tasks aligned when an exam is edited. */
export async function syncExamStudyReminders(exam: CalendarEntryRecord): Promise<void> {
  if (exam.kind !== "exam") return;

  const tasks = await getRecords("tasks");
  const linkedTasks = tasks.filter((task) => task.examReminderForId === exam.id);
  const initialized = exam.studyRemindersInitialized === true;
  const today = startOfDay(new Date());

  for (const offset of REMINDER_OFFSETS) {
    const dueAt = reminderDate(exam, offset);
    const matchingTask = linkedTasks.find((task) => task.examReminderOffsetDays === offset);
    if (matchingTask) {
      // Past reminders remain as task history; only future reminders track an edited exam date.
      if (dueAt >= today) {
        await updateRecord("tasks", matchingTask.id, {
          title: `Study for ${exam.title} (${offset}-day reminder)`,
          dueAt: dueAt.toISOString(),
          subjectId: exam.subjectId,
        });
      }
      continue;
    }

    // Once initialized, a reminder the user removed stays removed.
    if (initialized || dueAt < today) continue;
    await addRecord("tasks", {
      title: `Study for ${exam.title} (${offset}-day reminder)`,
      dueAt: dueAt.toISOString(),
      subjectId: exam.subjectId,
      priority: "medium",
      notes: "",
      completedAt: null,
      examReminderForId: exam.id,
      examReminderOffsetDays: offset,
    });
  }

  if (!initialized) {
    await updateRecord("calendarEntries", exam.id, { studyRemindersInitialized: true });
  }
}

/** Backfills exam reminders added before this feature was available. */
export async function initializeUnmarkedExamReminders(entries: CalendarEntryRecord[]): Promise<void> {
  for (const entry of entries) {
    if (entry.kind === "exam" && entry.studyRemindersInitialized !== true) {
      await syncExamStudyReminders(entry);
    }
  }
}
