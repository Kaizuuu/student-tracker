export interface BaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export type ReminderMinutesBefore = 10 | 30 | 60 | 1440 | null;

export interface SubjectRecord extends BaseRecord {
  name: string;
  color: string;
  notes?: string;
  links?: string[];
  room?: string;
  teacher?: string;
}

/** A weekly class occurrence. `dayOfWeek` uses JavaScript's 0 (Sunday) to 6 (Saturday). */
export interface ClassRecord extends BaseRecord {
  subjectId: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string;
  teacher: string;
  reminderMinutesBefore?: ReminderMinutesBefore;
}

export type TaskPriority = "low" | "medium" | "high";

export interface TaskRecord extends BaseRecord {
  title: string;
  dueAt: string | null;
  subjectId: string | null;
  priority: TaskPriority;
  notes: string;
  reminderMinutesBefore?: ReminderMinutesBefore;
  completedAt: string | null;
  /** Links an automatically created exam preparation task to its exam. */
  examReminderForId?: string;
  /** Preparation lead time for an automatically created reminder task. */
  examReminderOffsetDays?: 1 | 3 | 7;
}

export interface SubtaskRecord extends BaseRecord {
  taskId: string;
  title: string;
  position: number;
  completedAt: string | null;
}

/** A completed focus block, linked to the task and subject it supported. */
export interface FocusSessionRecord extends BaseRecord {
  taskId: string | null;
  subjectId: string | null;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
}

export interface HabitRecord extends BaseRecord {
  title: string;
  smallVersion: string | null;
}

export type HabitCompletionVersion = "full" | "small";

/** One completion per habit and local calendar date. */
export interface HabitCompletionRecord extends BaseRecord {
  habitId: string;
  date: string;
  version: HabitCompletionVersion;
}

export type RoutinePeriod = "morning" | "night";

export interface RoutineItemRecord extends BaseRecord {
  period: RoutinePeriod;
  title: string;
  position: number;
}

/** One daily check-off for one routine item. */
export interface RoutineCompletionRecord extends BaseRecord {
  itemId: string;
  date: string;
}

export type CalendarEntryKind = "exam" | "event";

export interface CalendarEntryRecord extends BaseRecord {
  kind: CalendarEntryKind;
  title: string;
  startsAt: string;
  endsAt: string | null;
  subjectId: string | null;
  location: string;
  notes: string;
  reminderMinutesBefore?: ReminderMinutesBefore;
  /** Prevents deleted generated tasks from being recreated on every load. */
  studyRemindersInitialized?: boolean;
}
