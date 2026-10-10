export interface ReminderScheduleSettings {
  habitTime: string;
  morningRoutineTime: string;
  nightRoutineTime: string;
  streakNudgeTime: string;
  timeZone: string;
}

export interface FocusTimerReminder {
  taskId: string;
  startedAt: string;
  endsAt: string;
}
