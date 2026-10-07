export interface BaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectRecord extends BaseRecord {
  name: string;
  color: string;
}

/** A weekly class occurrence. `dayOfWeek` uses JavaScript's 0 (Sunday) to 6 (Saturday). */
export interface ClassRecord extends BaseRecord {
  subjectId: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string;
  teacher: string;
}

export type TaskPriority = "low" | "medium" | "high";

export interface TaskRecord extends BaseRecord {
  title: string;
  dueAt: string | null;
  subjectId: string | null;
  priority: TaskPriority;
  notes: string;
  completedAt: string | null;
}

export interface SubtaskRecord extends BaseRecord {
  taskId: string;
  title: string;
  position: number;
  completedAt: string | null;
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
}
