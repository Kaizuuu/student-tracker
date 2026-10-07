import { getBackupRecords } from "@/lib/db";
import type { StudentTrackerBackup, StudentTrackerBackupRecords } from "@/types/backup";
import type { CalendarEntryKind, TaskPriority } from "@/types/records";

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
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    records: await getBackupRecords(),
  };
}

export function parseBackup(text: string): StudentTrackerBackup {
  if (text.length > MAX_BACKUP_FILE_BYTES) throw new Error("This backup is too large to import (limit: 10 MB).");

  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  if (!isObject(value) || value.app !== "student-tracker" || value.formatVersion !== 1 || !isObject(value.records)) {
    throw new Error("This is not a supported Student Tracker backup.");
  }
  const exportedAt = validDateString(value.exportedAt, "Backup exportedAt");

  const raw = value.records;
  const records: StudentTrackerBackupRecords = {
    subjects: recordArray(raw.subjects, "subjects").map((item, index) => {
      const label = `subjects[${index}]`;
      const base = parseBase(item, label);
      if (!isObject(item)) throw new Error(`${label} must be an object.`);
      return { ...base, name: requiredString(item.name, `${label}.name`), color: requiredString(item.color, `${label}.color`) };
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
      return {
        ...base,
        title: requiredString(item.title, `${label}.title`),
        dueAt: nullableDateString(item.dueAt, `${label}.dueAt`),
        subjectId: nullableString(item.subjectId, `${label}.subjectId`),
        priority: priority as TaskPriority,
        notes: requiredString(item.notes, `${label}.notes`, true),
        completedAt: nullableDateString(item.completedAt, `${label}.completedAt`),
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
      return {
        ...base,
        kind: kind as CalendarEntryKind,
        title: requiredString(item.title, `${label}.title`),
        startsAt: validDateString(item.startsAt, `${label}.startsAt`),
        endsAt: nullableDateString(item.endsAt, `${label}.endsAt`),
        subjectId: nullableString(item.subjectId, `${label}.subjectId`),
        location: requiredString(item.location, `${label}.location`, true),
        notes: requiredString(item.notes, `${label}.notes`, true),
      };
    }),
  };

  uniqueIds(records.subjects, "subjects");
  uniqueIds(records.classes, "classes");
  uniqueIds(records.tasks, "tasks");
  uniqueIds(records.subtasks, "subtasks");
  uniqueIds(records.calendarEntries, "calendarEntries");

  const subjectIds = new Set(records.subjects.map((record) => record.id));
  const taskIds = new Set(records.tasks.map((record) => record.id));
  const invalidSubjectLinks = [
    ...records.classes.map((record) => record.subjectId),
    ...records.tasks.map((record) => record.subjectId),
    ...records.calendarEntries.map((record) => record.subjectId),
  ].some((subjectId) => subjectId !== null && !subjectIds.has(subjectId));
  if (invalidSubjectLinks) throw new Error("Backup items refer to a subject that is not included in the file.");
  if (records.subtasks.some((subtask) => !taskIds.has(subtask.taskId))) throw new Error("Backup subtasks refer to a task that is not included in the file.");

  return {
    app: "student-tracker",
    formatVersion: 1,
    exportedAt,
    records,
  };
}
