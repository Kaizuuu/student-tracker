/** Formats a date using the device's local calendar day. */
export function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysBetween(earlier: string, later: string) {
  const [earlierYear, earlierMonth, earlierDay] = earlier.split("-").map(Number);
  const [laterYear, laterMonth, laterDay] = later.split("-").map(Number);
  const earlierUtc = Date.UTC(earlierYear, earlierMonth - 1, earlierDay);
  const laterUtc = Date.UTC(laterYear, laterMonth - 1, laterDay);
  return Math.round((laterUtc - earlierUtc) / 86_400_000);
}

/** Counts completed days in the current run, allowing one skipped day between check-ins. */
export function getForgivingStreak(completionDates: string[], today: string) {
  const dates = [...new Set(completionDates)]
    .filter((date) => date <= today)
    .sort((a, b) => b.localeCompare(a));
  if (!dates.length || daysBetween(dates[0], today) > 2) return 0;

  let streak = 1;
  let previous = dates[0];
  for (const date of dates.slice(1)) {
    if (daysBetween(date, previous) > 2) break;
    streak += 1;
    previous = date;
  }
  return streak;
}
