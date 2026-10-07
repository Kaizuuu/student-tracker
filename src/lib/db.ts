import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  CalendarEntryRecord,
  ClassRecord,
  SubtaskRecord,
  SubjectRecord,
  TaskRecord,
} from "@/types/records";
import type { BackupImportMode, StudentTrackerBackupRecords } from "@/types/backup";

const DATABASE_NAME = "student-tracker";
const DATABASE_VERSION = 1;

interface StudentTrackerDB extends DBSchema {
  subjects: {
    key: string;
    value: SubjectRecord;
    indexes: { "by-name": string };
  };
  classes: {
    key: string;
    value: ClassRecord;
    indexes: { "by-subject": string; "by-day": number };
  };
  tasks: {
    key: string;
    value: TaskRecord;
    indexes: { "by-subject": string; "by-due-at": string; "by-completed-at": string };
  };
  subtasks: {
    key: string;
    value: SubtaskRecord;
    indexes: { "by-task": string };
  };
  calendarEntries: {
    key: string;
    value: CalendarEntryRecord;
    indexes: { "by-kind": string; "by-starts-at": string; "by-subject": string };
  };
}

export type StoreName = "subjects" | "classes" | "tasks" | "subtasks" | "calendarEntries";
export type RecordFor<Store extends StoreName> = StudentTrackerDB[Store]["value"];

let databasePromise: Promise<IDBPDatabase<StudentTrackerDB>> | undefined;

function getDatabase(): Promise<IDBPDatabase<StudentTrackerDB>> {
  if (typeof indexedDB === "undefined") {
    throw new Error("Student Tracker storage is only available in a browser.");
  }

  if (!databasePromise) {
    databasePromise = openDB<StudentTrackerDB>(DATABASE_NAME, DATABASE_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains("subjects")) {
          database.createObjectStore("subjects", { keyPath: "id" }).createIndex("by-name", "name");
        }

        if (!database.objectStoreNames.contains("classes")) {
          const store = database.createObjectStore("classes", { keyPath: "id" });
          store.createIndex("by-subject", "subjectId");
          store.createIndex("by-day", "dayOfWeek");
        }

        if (!database.objectStoreNames.contains("tasks")) {
          const store = database.createObjectStore("tasks", { keyPath: "id" });
          store.createIndex("by-subject", "subjectId");
          store.createIndex("by-due-at", "dueAt");
          store.createIndex("by-completed-at", "completedAt");
        }

        if (!database.objectStoreNames.contains("subtasks")) {
          database.createObjectStore("subtasks", { keyPath: "id" }).createIndex("by-task", "taskId");
        }

        if (!database.objectStoreNames.contains("calendarEntries")) {
          const store = database.createObjectStore("calendarEntries", { keyPath: "id" });
          store.createIndex("by-kind", "kind");
          store.createIndex("by-starts-at", "startsAt");
          store.createIndex("by-subject", "subjectId");
        }
      },
      blocking() {
        databasePromise = undefined;
      },
      terminated() {
        databasePromise = undefined;
      },
    }).catch((error: unknown) => {
      databasePromise = undefined;
      throw error;
    });
  }

  return databasePromise;
}

type NewRecord<Store extends StoreName> = Omit<RecordFor<Store>, "id" | "createdAt" | "updatedAt">;
type RecordChanges<Store extends StoreName> = Partial<Omit<RecordFor<Store>, "id" | "createdAt">>;

/** Creates and persists a record, assigning its id and timestamps in one place. */
export async function addRecord<Store extends StoreName>(
  storeName: Store,
  fields: NewRecord<Store>,
): Promise<RecordFor<Store>> {
  const now = new Date().toISOString();
  const record = {
    ...fields,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  } as RecordFor<Store>;

  await (await getDatabase()).put(storeName, record);
  return record;
}

/** Reads a record by id. */
export async function getRecord<Store extends StoreName>(
  storeName: Store,
  id: string,
): Promise<RecordFor<Store> | undefined> {
  return (await getDatabase()).get(storeName, id);
}

/** Lists all records in a store. */
export async function getRecords<Store extends StoreName>(
  storeName: Store,
): Promise<RecordFor<Store>[]> {
  return (await getDatabase()).getAll(storeName);
}

/** Reads every data store from one readonly transaction for a consistent backup snapshot. */
export async function getBackupRecords(): Promise<StudentTrackerBackupRecords> {
  const transaction = (await getDatabase()).transaction(
    ["subjects", "classes", "tasks", "subtasks", "calendarEntries"],
    "readonly",
  );
  const [subjects, classes, tasks, subtasks, calendarEntries] = await Promise.all([
    transaction.objectStore("subjects").getAll(),
    transaction.objectStore("classes").getAll(),
    transaction.objectStore("tasks").getAll(),
    transaction.objectStore("subtasks").getAll(),
    transaction.objectStore("calendarEntries").getAll(),
  ]);
  await transaction.done;
  return { subjects, classes, tasks, subtasks, calendarEntries };
}

export interface BackupImportCounts {
  subjects: number;
  classes: number;
  tasks: number;
  subtasks: number;
  calendarEntries: number;
}

/** Imports a validated backup atomically, either merging by ID or replacing every store. */
export async function importBackupRecords(
  records: StudentTrackerBackupRecords,
  mode: BackupImportMode,
): Promise<BackupImportCounts> {
  const transaction = (await getDatabase()).transaction(
    ["subjects", "classes", "tasks", "subtasks", "calendarEntries"],
    "readwrite",
  );
  const subjects = transaction.objectStore("subjects");
  const classes = transaction.objectStore("classes");
  const tasks = transaction.objectStore("tasks");
  const subtasks = transaction.objectStore("subtasks");
  const calendarEntries = transaction.objectStore("calendarEntries");
  const clears = mode === "replace"
    ? [subjects.clear(), classes.clear(), tasks.clear(), subtasks.clear(), calendarEntries.clear()]
    : [];
  const writes = [
    ...records.subjects.map((record) => subjects.put(record)),
    ...records.classes.map((record) => classes.put(record)),
    ...records.tasks.map((record) => tasks.put(record)),
    ...records.subtasks.map((record) => subtasks.put(record)),
    ...records.calendarEntries.map((record) => calendarEntries.put(record)),
  ];

  await Promise.all([...clears, ...writes]);
  await transaction.done;
  return {
    subjects: records.subjects.length,
    classes: records.classes.length,
    tasks: records.tasks.length,
    subtasks: records.subtasks.length,
    calendarEntries: records.calendarEntries.length,
  };
}

/** Applies changes while preserving the original id and creation timestamp. */
export async function updateRecord<Store extends StoreName>(
  storeName: Store,
  id: string,
  changes: RecordChanges<Store>,
): Promise<RecordFor<Store>> {
  const database = await getDatabase();
  const transaction = database.transaction(storeName, "readwrite");
  const existing = await transaction.store.get(id);

  if (!existing) {
    transaction.abort();
    throw new Error(`Cannot update missing ${storeName} record: ${id}`);
  }

  const updated = {
    ...existing,
    ...changes,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  } as RecordFor<Store>;

  await transaction.store.put(updated);
  await transaction.done;
  return updated;
}

function tomorrowAtSameLocalTime(dueAt: string, today: Date) {
  const original = new Date(dueAt);
  return new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 1,
    original.getHours(),
    original.getMinutes(),
    original.getSeconds(),
    original.getMilliseconds(),
  );
}

/** Moves one still-overdue, open task to tomorrow and preserves its local time. */
export async function moveOverdueTaskToTomorrow(taskId: string, now = new Date()): Promise<TaskRecord | null> {
  const database = await getDatabase();
  const transaction = database.transaction("tasks", "readwrite");
  const store = transaction.store;
  const task = await store.get(taskId);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueAt = task?.dueAt ? new Date(task.dueAt) : null;

  if (!task?.dueAt || !dueAt || Number.isNaN(dueAt.getTime()) || task.completedAt || dueAt >= todayStart) {
    await transaction.done;
    return null;
  }

  const updated: TaskRecord = {
    ...task,
    dueAt: tomorrowAtSameLocalTime(task.dueAt, now).toISOString(),
    updatedAt: now.toISOString(),
  };
  await store.put(updated);
  await transaction.done;
  return updated;
}

/** Atomically moves every overdue open task to tomorrow, preserving each local time. */
export async function rescheduleAllOverdueTasksToTomorrow(now = new Date()): Promise<number> {
  const database = await getDatabase();
  const transaction = database.transaction("tasks", "readwrite");
  const store = transaction.store;
  const tasks = await store.getAll();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const overdue = tasks.filter((task) => task.dueAt && !task.completedAt && new Date(task.dueAt) < todayStart);
  const updatedAt = now.toISOString();

  await Promise.all(overdue.map((task) => store.put({
    ...task,
    dueAt: tomorrowAtSameLocalTime(task.dueAt!, now).toISOString(),
    updatedAt,
  })));
  await transaction.done;
  return overdue.length;
}

/** Deletes a record by id. */
export async function deleteRecord<Store extends StoreName>(storeName: Store, id: string): Promise<void> {
  await (await getDatabase()).delete(storeName, id);
}

/** Removes every record from a single store. */
export async function clearStore(storeName: StoreName): Promise<void> {
  await (await getDatabase()).clear(storeName);
}

export interface SubjectDeletionSummary {
  classes: number;
  tasks: number;
  calendarEntries: number;
}

/** Removes a subject and atomically unlinks its classes, tasks, and calendar entries. */
export async function deleteSubject(subjectId: string): Promise<SubjectDeletionSummary | null> {
  const database = await getDatabase();
  const transaction = database.transaction(
    ["subjects", "classes", "tasks", "calendarEntries"],
    "readwrite",
  );
  const subjects = transaction.objectStore("subjects");
  const subject = await subjects.get(subjectId);

  if (!subject) {
    await transaction.done;
    return null;
  }

  const classes = transaction.objectStore("classes");
  const tasks = transaction.objectStore("tasks");
  const calendarEntries = transaction.objectStore("calendarEntries");
  const [linkedClasses, linkedTasks, linkedEntries] = await Promise.all([
    classes.index("by-subject").getAll(subjectId),
    tasks.index("by-subject").getAll(subjectId),
    calendarEntries.index("by-subject").getAll(subjectId),
  ]);
  const updatedAt = new Date().toISOString();

  await Promise.all([
    ...linkedClasses.map((record) => classes.put({ ...record, subjectId: null, updatedAt })),
    ...linkedTasks.map((record) => tasks.put({ ...record, subjectId: null, updatedAt })),
    ...linkedEntries.map((record) => calendarEntries.put({ ...record, subjectId: null, updatedAt })),
    subjects.delete(subjectId),
  ]);
  await transaction.done;

  return {
    classes: linkedClasses.length,
    tasks: linkedTasks.length,
    calendarEntries: linkedEntries.length,
  };
}

/** Removes a task and its subtasks together. */
export async function deleteTask(taskId: string): Promise<number> {
  const database = await getDatabase();
  const transaction = database.transaction(["tasks", "subtasks"], "readwrite");
  const tasks = transaction.objectStore("tasks");
  const task = await tasks.get(taskId);

  if (!task) {
    await transaction.done;
    return 0;
  }

  const subtasks = transaction.objectStore("subtasks");
  const linkedSubtasks = await subtasks.index("by-task").getAll(taskId);
  await Promise.all([
    ...linkedSubtasks.map((subtask) => subtasks.delete(subtask.id)),
    tasks.delete(taskId),
  ]);
  await transaction.done;
  return linkedSubtasks.length;
}
