import type { CalendarEntryRecord, ClassRecord, FocusSessionRecord, HabitCompletionRecord, HabitRecord, RoutineCompletionRecord, RoutineItemRecord, SubtaskRecord, SubjectRecord, TaskRecord } from "@/types/records";

export interface StudentTrackerBackupRecords {
  subjects: SubjectRecord[];
  classes: ClassRecord[];
  tasks: TaskRecord[];
  subtasks: SubtaskRecord[];
  calendarEntries: CalendarEntryRecord[];
  habits: HabitRecord[];
  habitCompletions: HabitCompletionRecord[];
  routineItems: RoutineItemRecord[];
  routineCompletions: RoutineCompletionRecord[];
  focusSessions: FocusSessionRecord[];
}

export interface StudentTrackerBackup {
  app: "student-tracker";
  formatVersion: 1 | 2 | 3 | 4;
  exportedAt: string;
  records: StudentTrackerBackupRecords;
}

export type BackupImportMode = "merge" | "replace";
