import type { CalendarEntryRecord, ClassRecord, SubtaskRecord, SubjectRecord, TaskRecord } from "@/types/records";

export interface StudentTrackerBackupRecords {
  subjects: SubjectRecord[];
  classes: ClassRecord[];
  tasks: TaskRecord[];
  subtasks: SubtaskRecord[];
  calendarEntries: CalendarEntryRecord[];
}

export interface StudentTrackerBackup {
  app: "student-tracker";
  formatVersion: 1;
  exportedAt: string;
  records: StudentTrackerBackupRecords;
}

export type BackupImportMode = "merge" | "replace";
