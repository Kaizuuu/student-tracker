import type { FocusTimerReminder } from "@/types/reminders";

export const FOCUS_TIMER_STORAGE_KEY = "student-tracker-focus-timer";

export function readRunningFocusTimer(): FocusTimerReminder | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(FOCUS_TIMER_STORAGE_KEY);
    if (!raw) return undefined;
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (value.mode !== "focus" || value.running !== true || typeof value.taskId !== "string" || typeof value.startedAt !== "string" || typeof value.endsAt !== "number" || !Number.isFinite(value.endsAt)) {
      return undefined;
    }
    return {
      taskId: value.taskId,
      startedAt: value.startedAt,
      endsAt: new Date(value.endsAt).toISOString(),
    };
  } catch {
    return undefined;
  }
}
