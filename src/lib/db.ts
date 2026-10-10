import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  CalendarEntryRecord,
  ClassRecord,
  FocusSessionRecord,
  HabitCompletionRecord,
  HabitCompletionVersion,
  HabitRecord,
  RoutineCompletionRecord,
  RoutineItemRecord,
  SubtaskRecord,
  SubjectRecord,
  TaskRecord,
} from "@/types/records";
import type { BackupImportMode, StudentTrackerBackupRecords } from "@/types/backup";

const DATABASE_NAME = "student-tracker";
const DATABASE_VERSION = 4;

function queueReminderBackupSync() {
  void import("@/lib/reminderSync").then(({ queueReminderBackupSync: queue }) => queue()).catch(() => {
    // Local saves must not fail if the optional push sync is unavailable.
  });
}

function affectsReminders(storeName: StoreName) {
  return storeName === "tasks" || storeName === "classes" || storeName === "calendarEntries" || storeName === "subjects" ||
    storeName === "habits" || storeName === "habitCompletions" || storeName === "routineItems" || storeName === "routineCompletions";
}

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
  habits: {
    key: string;
    value: HabitRecord;
    indexes: Record<never, never>;
  };
  habitCompletions: {
    key: string;
    value: HabitCompletionRecord;
    indexes: { "by-habit": string; "by-date": string };
  };
  routineItems: {
    key: string;
    value: RoutineItemRecord;
    indexes: { "by-period": string };
  };
  routineCompletions: {
    key: string;
    value: RoutineCompletionRecord;
    indexes: { "by-item": string; "by-date": string };
  };
  focusSessions: {
    key: string;
    value: FocusSessionRecord;
    indexes: { "by-task": string; "by-subject": string; "by-ended-at": string };
  };
}

export type StoreName = "subjects" | "classes" | "tasks" | "subtasks" | "calendarEntries" | "habits" | "habitCompletions" | "routineItems" | "routineCompletions" | "focusSessions";
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

        if (!database.objectStoreNames.contains("habits")) {
          database.createObjectStore("habits", { keyPath: "id" });
        }

        if (!database.objectStoreNames.contains("habitCompletions")) {
          const store = database.createObjectStore("habitCompletions", { keyPath: "id" });
          store.createIndex("by-habit", "habitId");
          store.createIndex("by-date", "date");
        }

        if (!database.objectStoreNames.contains("routineItems")) {
          const store = database.createObjectStore("routineItems", { keyPath: "id" });
          store.createIndex("by-period", "period");
        }

        if (!database.objectStoreNames.contains("routineCompletions")) {
          const store = database.createObjectStore("routineCompletions", { keyPath: "id" });
          store.createIndex("by-item", "itemId");
          store.createIndex("by-date", "date");
        }

        if (!database.objectStoreNames.contains("focusSessions")) {
          const store = database.createObjectStore("focusSessions", { keyPath: "id" });
          store.createIndex("by-task", "taskId");
          store.createIndex("by-subject", "subjectId");
          store.createIndex("by-ended-at", "endedAt");
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
  if (affectsReminders(storeName)) queueReminderBackupSync();
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
    ["subjects", "classes", "tasks", "subtasks", "calendarEntries", "habits", "habitCompletions", "routineItems", "routineCompletions", "focusSessions"],
    "readonly",
  );
  const [subjects, classes, tasks, subtasks, calendarEntries, habits, habitCompletions, routineItems, routineCompletions, focusSessions] = await Promise.all([
    transaction.objectStore("subjects").getAll(),
    transaction.objectStore("classes").getAll(),
    transaction.objectStore("tasks").getAll(),
    transaction.objectStore("subtasks").getAll(),
    transaction.objectStore("calendarEntries").getAll(),
    transaction.objectStore("habits").getAll(),
    transaction.objectStore("habitCompletions").getAll(),
    transaction.objectStore("routineItems").getAll(),
    transaction.objectStore("routineCompletions").getAll(),
    transaction.objectStore("focusSessions").getAll(),
  ]);
  await transaction.done;
  return { subjects, classes, tasks, subtasks, calendarEntries, habits, habitCompletions, routineItems, routineCompletions, focusSessions };
}

export interface BackupImportCounts {
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
}

/** Imports a validated backup atomically, either merging by ID or replacing every store. */
export async function importBackupRecords(
  records: StudentTrackerBackupRecords,
  mode: BackupImportMode,
): Promise<BackupImportCounts> {
  const transaction = (await getDatabase()).transaction(
    ["subjects", "classes", "tasks", "subtasks", "calendarEntries", "habits", "habitCompletions", "routineItems", "routineCompletions", "focusSessions"],
    "readwrite",
  );
  const subjects = transaction.objectStore("subjects");
  const classes = transaction.objectStore("classes");
  const tasks = transaction.objectStore("tasks");
  const subtasks = transaction.objectStore("subtasks");
  const calendarEntries = transaction.objectStore("calendarEntries");
  const habits = transaction.objectStore("habits");
  const habitCompletions = transaction.objectStore("habitCompletions");
  const routineItems = transaction.objectStore("routineItems");
  const routineCompletions = transaction.objectStore("routineCompletions");
  const focusSessions = transaction.objectStore("focusSessions");
  const clears = mode === "replace"
    ? [subjects.clear(), classes.clear(), tasks.clear(), subtasks.clear(), calendarEntries.clear(), habits.clear(), habitCompletions.clear(), routineItems.clear(), routineCompletions.clear(), focusSessions.clear()]
    : [];
  const writes = [
    ...records.subjects.map((record) => subjects.put(record)),
    ...records.classes.map((record) => classes.put(record)),
    ...records.tasks.map((record) => tasks.put(record)),
    ...records.subtasks.map((record) => subtasks.put(record)),
    ...records.calendarEntries.map((record) => calendarEntries.put(record)),
    ...records.habits.map((record) => habits.put(record)),
    ...records.habitCompletions.map((record) => habitCompletions.put(record)),
    ...records.routineItems.map((record) => routineItems.put(record)),
    ...records.routineCompletions.map((record) => routineCompletions.put(record)),
    ...records.focusSessions.map((record) => focusSessions.put(record)),
  ];

  await Promise.all([...clears, ...writes]);
  await transaction.done;
  queueReminderBackupSync();
  return {
    subjects: records.subjects.length,
    classes: records.classes.length,
    tasks: records.tasks.length,
    subtasks: records.subtasks.length,
    calendarEntries: records.calendarEntries.length,
    habits: records.habits.length,
    habitCompletions: records.habitCompletions.length,
    routineItems: records.routineItems.length,
    routineCompletions: records.routineCompletions.length,
    focusSessions: records.focusSessions.length,
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
  if (affectsReminders(storeName)) queueReminderBackupSync();
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
  queueReminderBackupSync();
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
  if (overdue.length) queueReminderBackupSync();
  return overdue.length;
}

/** Deletes a record by id. */
export async function deleteRecord<Store extends StoreName>(storeName: Store, id: string): Promise<void> {
  await (await getDatabase()).delete(storeName, id);
  if (affectsReminders(storeName)) queueReminderBackupSync();
}

/** Checks or unchecks one habit for a local calendar date. */
export async function toggleHabitCompletion(
  habitId: string,
  date: string,
  version: HabitCompletionVersion = "full",
): Promise<"checked" | "changed" | "unchecked"> {
  const database = await getDatabase();
  const transaction = database.transaction(["habits", "habitCompletions"], "readwrite");
  const habit = await transaction.objectStore("habits").get(habitId);
  if (!habit) {
    await transaction.done;
    throw new Error(`Cannot complete missing habit: ${habitId}`);
  }

  const store = transaction.objectStore("habitCompletions");
  const id = `${habitId}:${date}`;
  const existing = await store.get(id);
  if (existing) {
    if ((existing.version ?? "full") === version) {
      await store.delete(id);
      await transaction.done;
      queueReminderBackupSync();
      return "unchecked";
    }
    await store.put({ ...existing, version, updatedAt: new Date().toISOString() });
    await transaction.done;
    queueReminderBackupSync();
    return "changed";
  }

  const now = new Date().toISOString();
  await store.put({ id, habitId, date, version, createdAt: now, updatedAt: now });
  await transaction.done;
  queueReminderBackupSync();
  return "checked";
}

/** Removes a habit and its completion history atomically. */
export async function deleteHabit(habitId: string): Promise<boolean> {
  const database = await getDatabase();
  const transaction = database.transaction(["habits", "habitCompletions"], "readwrite");
  const habits = transaction.objectStore("habits");
  const habit = await habits.get(habitId);
  if (!habit) {
    await transaction.done;
    return false;
  }

  const completions = transaction.objectStore("habitCompletions");
  const history = await completions.index("by-habit").getAll(habitId);
  await Promise.all([
    habits.delete(habitId),
    ...history.map((completion) => completions.delete(completion.id)),
  ]);
  await transaction.done;
  queueReminderBackupSync();
  return true;
}

/** Checks or unchecks a routine item for a local calendar date. */
export async function toggleRoutineCompletion(itemId: string, date: string): Promise<boolean> {
  const database = await getDatabase();
  const transaction = database.transaction(["routineItems", "routineCompletions"], "readwrite");
  const item = await transaction.objectStore("routineItems").get(itemId);
  if (!item) {
    await transaction.done;
    throw new Error(`Cannot complete missing routine item: ${itemId}`);
  }

  const store = transaction.objectStore("routineCompletions");
  const id = `${itemId}:${date}`;
  const existing = await store.get(id);
  if (existing) {
    await store.delete(id);
    await transaction.done;
    queueReminderBackupSync();
    return false;
  }

  const now = new Date().toISOString();
  await store.put({ id, itemId, date, createdAt: now, updatedAt: now });
  await transaction.done;
  queueReminderBackupSync();
  return true;
}

/** Removes a routine item and its check-in history, then closes the order gap. */
export async function deleteRoutineItem(itemId: string): Promise<boolean> {
  const database = await getDatabase();
  const transaction = database.transaction(["routineItems", "routineCompletions"], "readwrite");
  const items = transaction.objectStore("routineItems");
  const item = await items.get(itemId);
  if (!item) {
    await transaction.done;
    return false;
  }

  const completions = transaction.objectStore("routineCompletions");
  const history = await completions.index("by-item").getAll(itemId);
  const siblings = (await items.index("by-period").getAll(item.period))
    .filter((candidate) => candidate.id !== itemId)
    .sort((a, b) => a.position - b.position);
  const now = new Date().toISOString();
  await Promise.all([
    items.delete(itemId),
    ...history.map((completion) => completions.delete(completion.id)),
    ...siblings.map((sibling, position) => items.put({ ...sibling, position, updatedAt: now })),
  ]);
  await transaction.done;
  queueReminderBackupSync();
  return true;
}

/** Moves one routine item up or down while keeping its section order contiguous. */
export async function moveRoutineItem(itemId: string, direction: -1 | 1): Promise<boolean> {
  const database = await getDatabase();
  const transaction = database.transaction("routineItems", "readwrite");
  const store = transaction.store;
  const item = await store.get(itemId);
  if (!item) {
    await transaction.done;
    return false;
  }

  const items = (await store.index("by-period").getAll(item.period)).sort((a, b) => a.position - b.position);
  const currentIndex = items.findIndex((candidate) => candidate.id === itemId);
  const nextIndex = currentIndex + direction;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= items.length) {
    await transaction.done;
    return false;
  }

  const [moved] = items.splice(currentIndex, 1);
  items.splice(nextIndex, 0, moved);
  const now = new Date().toISOString();
  await Promise.all(items.map((candidate, position) => store.put({ ...candidate, position, updatedAt: now })));
  await transaction.done;
  queueReminderBackupSync();
  return true;
}

/** Removes every record from a single store. */
export async function clearStore(storeName: StoreName): Promise<void> {
  await (await getDatabase()).clear(storeName);
  if (affectsReminders(storeName)) queueReminderBackupSync();
}

export interface SubjectDeletionSummary {
  classes: number;
  tasks: number;
  calendarEntries: number;
  focusSessions: number;
}

/** Removes a subject and atomically unlinks its classes, tasks, and calendar entries. */
export async function deleteSubject(subjectId: string): Promise<SubjectDeletionSummary | null> {
  const database = await getDatabase();
  const transaction = database.transaction(
    ["subjects", "classes", "tasks", "calendarEntries", "focusSessions"],
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
  const focusSessions = transaction.objectStore("focusSessions");
  const [linkedClasses, linkedTasks, linkedEntries, linkedFocusSessions] = await Promise.all([
    classes.index("by-subject").getAll(subjectId),
    tasks.index("by-subject").getAll(subjectId),
    calendarEntries.index("by-subject").getAll(subjectId),
    focusSessions.index("by-subject").getAll(subjectId),
  ]);
  const updatedAt = new Date().toISOString();

  await Promise.all([
    ...linkedClasses.map((record) => classes.put({ ...record, subjectId: null, updatedAt })),
    ...linkedTasks.map((record) => tasks.put({ ...record, subjectId: null, updatedAt })),
    ...linkedEntries.map((record) => calendarEntries.put({ ...record, subjectId: null, updatedAt })),
    ...linkedFocusSessions.map((record) => focusSessions.put({ ...record, subjectId: null, updatedAt })),
    subjects.delete(subjectId),
  ]);
  await transaction.done;

  queueReminderBackupSync();

  return {
    classes: linkedClasses.length,
    tasks: linkedTasks.length,
    calendarEntries: linkedEntries.length,
    focusSessions: linkedFocusSessions.length,
  };
}

/** Removes a task and its subtasks together. */
export async function deleteTask(taskId: string): Promise<number> {
  const database = await getDatabase();
  const transaction = database.transaction(["tasks", "subtasks", "focusSessions"], "readwrite");
  const tasks = transaction.objectStore("tasks");
  const task = await tasks.get(taskId);

  if (!task) {
    await transaction.done;
    return 0;
  }

  const subtasks = transaction.objectStore("subtasks");
  const linkedSubtasks = await subtasks.index("by-task").getAll(taskId);
  const focusSessions = transaction.objectStore("focusSessions");
  const linkedFocusSessions = await focusSessions.index("by-task").getAll(taskId);
  const updatedAt = new Date().toISOString();
  await Promise.all([
    ...linkedSubtasks.map((subtask) => subtasks.delete(subtask.id)),
    ...linkedFocusSessions.map((session) => focusSessions.put({ ...session, taskId: null, updatedAt })),
    tasks.delete(taskId),
  ]);
  await transaction.done;
  queueReminderBackupSync();
  return linkedSubtasks.length;
}
