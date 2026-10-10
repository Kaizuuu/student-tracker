import type { ReminderScheduleSettings } from "@/types/reminders";

const STORAGE_KEY = "student-tracker-reminder-schedule-v1";
const DEFAULTS: Omit<ReminderScheduleSettings, "timeZone"> = {
  habitTime: "08:00",
  morningRoutineTime: "07:00",
  nightRoutineTime: "20:00",
  streakNudgeTime: "21:00",
};

export function isReminderTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function validTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function defaultReminderSettings(): ReminderScheduleSettings {
  const timeZone = typeof Intl !== "undefined"
    ? Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Manila"
    : "Asia/Manila";
  return { ...DEFAULTS, timeZone };
}

export function parseReminderSettings(value: unknown): ReminderScheduleSettings {
  const defaults = defaultReminderSettings();
  if (typeof value !== "object" || value === null) return defaults;
  const settings = value as Partial<ReminderScheduleSettings>;
  return {
    habitTime: isReminderTime(settings.habitTime) ? settings.habitTime : defaults.habitTime,
    morningRoutineTime: isReminderTime(settings.morningRoutineTime) ? settings.morningRoutineTime : defaults.morningRoutineTime,
    nightRoutineTime: isReminderTime(settings.nightRoutineTime) ? settings.nightRoutineTime : defaults.nightRoutineTime,
    streakNudgeTime: isReminderTime(settings.streakNudgeTime) ? settings.streakNudgeTime : defaults.streakNudgeTime,
    timeZone: validTimeZone(settings.timeZone) ? settings.timeZone : defaults.timeZone,
  };
}

export function getReminderSettings(): ReminderScheduleSettings {
  if (typeof window === "undefined") return defaultReminderSettings();
  try {
    return parseReminderSettings(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"));
  } catch {
    return defaultReminderSettings();
  }
}

export function saveReminderSettings(settings: ReminderScheduleSettings) {
  const normalized = parseReminderSettings(settings);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event("student-tracker-reminder-settings"));
  return normalized;
}
