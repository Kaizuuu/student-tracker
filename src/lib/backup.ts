import { getBackupRecords } from "@/lib/db";
import type { StudentTrackerBackup, StudentTrackerBackupRecords } from "@/types/backup";
import type { CalendarEntryKind, RoutinePeriod, TaskPriority } from "@/types/records";

export const MAX_BACKUP_FILE_BYTES = 10 * 1024 * 1024;
const MAX_RECORDS_PER_STORE = 50_000;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, label: string, allowEmpty = false): string {
  if (typeof value !== "string" || (!allowEmpty && value.trim().length === 0)) {
    throw new Error(`${label} must be ${allowEmpty ? "a string" : "a non-empty string"}.`);
  }
  return value;
}

function validDateString(value: unknown, label: string): string {
  const date = requiredString(value, label);
  if (Number.isNaN(Date.parse(date))) throw new Error(`${label} is not a valid date.`);
  return date;
}

function nullableDateString(value: unknown, label: string): string | null {
  return value === null ? null : validDateString(value, label);
}

function nullableString(value: unknown, label: string): string | null {
  return value === null ? null : requiredString(value, label);
}

function parseBase(value: unknown, label: string) {
  if (!isObject(value)) throw new Error(`${label} must be an object.`);
  return {
    id: requiredString(value.id, `${label}.id`),
    createdAt: validDateString(value.createdAt, `${label}.createdAt`),
    updatedAt: validDateString(value.updatedAt, `${label}.updatedAt`),
  };
}

function recordArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Backup ${label} must be an array.`);
  if (value.length > MAX_RECORDS_PER_STORE) throw new Error(`Backup ${label} contains too many records.`);
  return value;
}

function subjectLinks(value: unknown, label: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 15) throw new Error(`${label} must contain at most 15 links.`);
  return value.map((item, index) => {
    const link = requiredString(item, `${label}[${index}]`);
    try {
      const url = new URL(link);
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    } catch {
      throw new Error(`${label}[${index}] must be an http or https URL.`);
    }
    return link;
  });
}

function uniqueIds<T extends { id: string }>(records: T[], label: string) {
  const ids = new Set<string>();
  for (const record of records) {
    if (ids.has(record.id)) throw new Error(`Backup ${label} contains duplicate IDs.`);
    ids.add(record.id);
  }
}

export async function createBackup(): Promise<StudentTrackerBackup> {
  return {
    app: "student-tracker",
    formatVersion: 4,
    exportedAt: new Date().toISOString(),
    records: await getBackupRecords(),
  };
}

function habitDayString(value: unknown, label: string): string {
  const day = requiredString(value, label);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) throw new Error(`${label} must use YYYY-MM-DD format.`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.toISOString().slice(0, 10) !== day) throw new Error(`${label} is not a valid calendar date.`);
  return day;
}

export function parseBackup(text: string): StudentTrackerBackup {
  if (text.length > MAX_BACKUP_FILE_BYTES) throw new Error("This backup is too large to import (limit: 10 MB).");

  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  if (!isObject(value) || value.app !== "student-tracker" || (value.formatVersion !== 1 && value.formatVersion !== 2 && value.formatVersion !== 3 && value.formatVersion !== 4) || !isObject(value.records)) {
    throw new Error("This is not a supported Student Tracker backup.");
  }
  const exportedAt = validDateString(value.exportedAt, "Backup exportedAt");

  const raw = value.records;
  const records: StudentTrackerBackupRecords = {
    subjects: recordArray(raw.subjects, "subjects").map((item, index) => {
      const label = `subjects[${index}]`;
      const base = parseBase(item, label);
      if (!isObject(item)) throw new Error(`${label} must be an object.`);
      return {
        ...base,
        name: requiredString(item.name, `${label}.name`),
        color: requiredString(item.color, `${label}.color`),
        notes: item.notes === undefined ? "" : requiredString(item.notes, `${label}.notes`, true),
        links: subjectLinks(item.links, `${label}.links`),
        room: item.room === undefined ? "" : requiredString(item.room, `${label}.room`, true),
        teacher: item.teacher === undefined ? "" : requiredString(item.teacher, `${label}.teacher`, true),
      };
    }),
    classes: recordArray(raw.classes, "classes").map((item, index) => {
      const label = `classes[${index}]`;
      const base = parseBase(item, label);
      if (!isObject(item)) throw new Error(`${label} must be an object.`);
      const dayOfWeek = item.dayOfWeek;
      const startTime = requiredString(item.startTime, `${label}.startTime`);
      const endTime = requiredString(item.endTime, `${label}.endTime`);
      if (!Number.isInteger(dayOfWeek) || Number(dayOfWeek) < 0 || Number(dayOfWeek) > 6) throw new Error(`${label}.dayOfWeek must be from 0 to 6.`);
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)) throw new Error(`${label} has an invalid class time.`);
      return {
        ...base,
        subjectId: nullableString(item.subjectId, `${label}.subjectId`),
        dayOfWeek: Number(dayOfWeek),
        startTime,
        endTime,
        room: requiredString(item.room, `${label}.room`, true),
        teacher: requiredString(item.teacher, `${label}.teacher`, true),
      };
    }),
    tasks: recordArray(raw.tasks, "tasks").map((item, index) => {
      const label = `tasks[${index}]`;
      const base = parseBase(item, label);
      if (!isObject(item)) throw new Error(`${label} must be an object.`);
      const priority = item.priority;
      if (priority !== "low" && priority !== "medium" && priority !== "high") throw new Error(`${label}.priority is invalid.`);
      const reminderOffset = item.examReminderOffsetDays;
      if (reminderOffset !== undefined && reminderOffset !== 1 && reminderOffset !== 3 && reminderOffset !== 7) throw new Error(`${label}.examReminderOffsetDays is invalid.`);
      return {
        ...base,
        title: requiredString(item.title, `${label}.title`),
        dueAt: nullableDateString(item.dueAt, `${label}.dueAt`),
        subjectId: nullableString(item.subjectId, `${label}.subjectId`),
        priority: priority as TaskPriority,
        notes: requiredString(item.notes, `${label}.notes`, true),
        completedAt: nullableDateString(item.completedAt, `${label}.completedAt`),
        ...(item.examReminderForId === undefined ? {} : { examReminderForId: requiredString(item.examReminderForId, `${label}.examReminderForId`) }),
        ...(reminderOffset === undefined ? {} : { examReminderOffsetDays: reminderOffset as 1 | 3 | 7 }),
      };
    }),
    subtasks: recordArray(raw.subtasks, "subtasks").map((item, index) => {
      const label = `subtasks[${index}]`;
      const base = parseBase(item, label);
      if (!isObject(item)) throw new Error(`${label} must be an object.`);
      if (!Number.isInteger(item.position) || Number(item.position) < 0) throw new Error(`${label}.position must be a non-negative integer.`);
      return {
        ...base,
        taskId: requiredString(item.taskId, `${label}.taskId`),
        title: requiredString(item.title, `${label}.title`),
        position: Number(item.position),
        completedAt: nullableDateString(item.completedAt, `${label}.completedAt`),
      };
    }),
    calendarEntries: recordArray(raw.calendarEntries, "calendarEntries").map((item, index) => {
      const label = `calendarEntries[${index}]`;
      const base = parseBase(item, label);
      if (!isObject(item)) throw new Error(`${label} must be an object.`);
      const kind = item.kind;
      if (kind !== "exam" && kind !== "event") throw new Error(`${label}.kind is invalid.`);
      if (item.studyRemindersInitialized !== undefined && typeof item.studyRemindersInitialized !== "boolean") throw new Error(`${label}.studyRemindersInitialized must be true or false.`);
      return {
        ...base,
        kind: kind as CalendarEntryKind,
        title: requiredString(item.title, `${label}.title`),
        startsAt: validDateString(item.startsAt, `${label}.startsAt`),
        endsAt: nullableDateString(item.endsAt, `${label}.endsAt`),
        subjectId: nullableString(item.subjectId, `${label}.subjectId`),
        location: requiredString(item.location, `${label}.location`, true),
        notes: requiredString(item.notes, `${label}.notes`, true),
        ...(item.studyRemindersInitialized === undefined ? {} : { studyRemindersInitialized: item.studyRemindersInitialized }),
      };
    }),
    habits: (raw.habits === undefined ? [] : recordArray(raw.habits, "habits")).map((item, index) => {
      const label = `habits[${index}]`;
      const base = parseBase(item, label);
      if (!isObject(item)) throw new Error(`${label} must be an object.`);
      return {
        ...base,
        title: requiredString(item.title, `${label}.title`),
        smallVersion: item.smallVersion === undefined ? null : nullableString(item.smallVersion, `${label}.smallVersion`),
      };
    }),
    habitCompletions: (raw.habitCompletions === undefined ? [] : recordArray(raw.habitCompletions, "habitCompletions")).map((item, index) => {
      const label = `habitCompletions[${index}]`;
      const base = parseBase(item, label);
      if (!isObject(item)) throw new Error(`${label} must be an object.`);
      const version = item.version ?? "full";
      if (version !== "full" && version !== "small") throw new Error(`${label}.version is invalid.`);
      return {
        ...base,
        habitId: requiredString(item.habitId, `${label}.habitId`),
        date: habitDayString(item.date, `${label}.date`),
        version,
      };
    }),
    routineItems: (raw.routineItems === undefined ? [] : recordArray(raw.routineItems, "routineItems")).map((item, index) => {
      const label = `routineItems[${index}]`;
      const base = parseBase(item, label);
      if (!isObject(item)) throw new Error(`${label} must be an object.`);
      const period = item.period;
      if (period !== "morning" && period !== "night") throw new Error(`${label}.period is invalid.`);
      if (!Number.isInteger(item.position) || Number(item.position) < 0) throw new Error(`${label}.position must be a non-negative integer.`);
      return {
        ...base,
        period: period as RoutinePeriod,
        title: requiredString(item.title, `${label}.title`),
        position: Number(item.position),
      };
    }),
    routineCompletions: (raw.routineCompletions === undefined ? [] : recordArray(raw.routineCompletions, "routineCompletions")).map((item, index) => {
      const label = `routineCompletions[${index}]`;
      const base = parseBase(item, label);
      if (!isObject(item)) throw new Error(`${label} must be an object.`);
      return {
        ...base,
        itemId: requiredString(item.itemId, `${label}.itemId`),
        date: habitDayString(item.date, `${label}.date`),
      };
    }),
    focusSessions: (raw.focusSessions === undefined ? [] : recordArray(raw.focusSessions, "focusSessions")).map((item, index) => {
      const label = `focusSessions[${index}]`;
      const base = parseBase(item, label);
      if (!isObject(item)) throw new Error(`${label} must be an object.`);
      if (!Number.isInteger(item.durationSeconds) || Number(item.durationSeconds) < 1 || Number(item.durationSeconds) > 86_400) throw new Error(`${label}.durationSeconds must be from 1 to 86400.`);
      return {
        ...base,
        taskId: nullableString(item.taskId, `${label}.taskId`),
        subjectId: nullableString(item.subjectId, `${label}.subjectId`),
        startedAt: validDateString(item.startedAt, `${label}.startedAt`),
        endedAt: validDateString(item.endedAt, `${label}.endedAt`),
        durationSeconds: Number(item.durationSeconds),
      };
    }),
  };

  uniqueIds(records.subjects, "subjects");
  uniqueIds(records.classes, "classes");
  uniqueIds(records.tasks, "tasks");
  uniqueIds(records.subtasks, "subtasks");
  uniqueIds(records.calendarEntries, "calendarEntries");
  uniqueIds(records.habits, "habits");
  uniqueIds(records.habitCompletions, "habitCompletions");
  uniqueIds(records.routineItems, "routineItems");
  uniqueIds(records.routineCompletions, "routineCompletions");
  uniqueIds(records.focusSessions, "focusSessions");

  const subjectIds = new Set(records.subjects.map((record) => record.id));
  const taskIds = new Set(records.tasks.map((record) => record.id));
  const habitIds = new Set(records.habits.map((record) => record.id));
  const routineItemIds = new Set(records.routineItems.map((record) => record.id));
  const invalidSubjectLinks = [
    ...records.classes.map((record) => record.subjectId),
    ...records.tasks.map((record) => record.subjectId),
    ...records.calendarEntries.map((record) => record.subjectId),
    ...records.focusSessions.map((record) => record.subjectId),
  ].some((subjectId) => subjectId !== null && !subjectIds.has(subjectId));
  if (invalidSubjectLinks) throw new Error("Backup items refer to a subject that is not included in the file.");
  if (records.subtasks.some((subtask) => !taskIds.has(subtask.taskId))) throw new Error("Backup subtasks refer to a task that is not included in the file.");
  if (records.tasks.some((task) => Boolean(task.examReminderForId) !== Boolean(task.examReminderOffsetDays))) throw new Error("Backup study reminder links are incomplete.");
  if (records.focusSessions.some((session) => session.taskId !== null && !taskIds.has(session.taskId))) throw new Error("Backup focus sessions refer to a task that is not included in the file.");
  if (records.habitCompletions.some((completion) => !habitIds.has(completion.habitId))) throw new Error("Backup habit completions refer to a habit that is not included in the file.");
  if (records.routineCompletions.some((completion) => !routineItemIds.has(completion.itemId))) throw new Error("Backup routine check-ins refer to a routine item that is not included in the file.");
  for (const period of ["morning", "night"] as const) {
    const positions = records.routineItems.filter((item) => item.period === period).map((item) => item.position);
    if (new Set(positions).size !== positions.length) throw new Error(`Backup ${period} routine contains duplicate item positions.`);
  }

  return {
    app: "student-tracker",
    formatVersion: value.formatVersion,
    exportedAt,
    records,
  };
}
