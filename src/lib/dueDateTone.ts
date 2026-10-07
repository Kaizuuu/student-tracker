import { differenceInCalendarDays } from "date-fns";

export type DueDateTone = "overdue" | "today" | "upcoming" | "none";

/** Classifies a date by local calendar day; optionally treat an earlier time today as overdue. */
export function getDueDateTone(value: string | null, now = new Date(), earlierTodayIsOverdue = false): DueDateTone {
  if (!value) return "none";
  const dueDate = new Date(value);
  if (Number.isNaN(dueDate.getTime())) return "none";
  if (earlierTodayIsOverdue && dueDate < now) return "overdue";

  const daysUntilDue = differenceInCalendarDays(dueDate, now);
  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue === 0) return "today";
  return "upcoming";
}

export function dueDateTextClasses(tone: DueDateTone) {
  switch (tone) {
    case "overdue":
      return "text-red-700 dark:text-red-300";
    case "today":
      return "text-amber-800 dark:text-amber-300";
    case "upcoming":
    case "none":
      return "text-muted";
  }
}

export function dueDateBadgeClasses(tone: DueDateTone) {
  switch (tone) {
    case "overdue":
      return "bg-red-500/10 text-red-700 dark:text-red-300";
    case "today":
      return "bg-amber-500/10 text-amber-800 dark:text-amber-300";
    case "upcoming":
      return "bg-accent/10 text-accent";
    case "none":
      return "bg-background text-muted";
  }
}
