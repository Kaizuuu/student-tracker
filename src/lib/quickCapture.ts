import type { TaskPriority } from "@/types/records";

export interface ParsedQuickCapture {
  title: string;
  dueAt: string | null;
  priority: TaskPriority;
}

type TextRange = { index: number; length: number };

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function makeLocalDate(year: number, month: number, day: number) {
  const date = new Date(year, month, day);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null;
}

function parseDatePhrase(text: string, now: Date): { date: Date; range: TextRange } | null {
  const relativeMatch = /\b(today|tomorrow|tonight)\b/i.exec(text);
  if (relativeMatch && relativeMatch.index !== undefined) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (relativeMatch[1].toLowerCase() === "tomorrow") date.setDate(date.getDate() + 1);
    return { date, range: { index: relativeMatch.index, length: relativeMatch[0].length } };
  }

  const weekdayMatch = /\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.exec(text);
  if (weekdayMatch && weekdayMatch.index !== undefined) {
    const day = WEEKDAYS.indexOf(weekdayMatch[2].toLowerCase());
    let offset = (day - now.getDay() + 7) % 7;
    if (weekdayMatch[1]) offset = offset === 0 ? 7 : offset + 7;
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    return { date, range: { index: weekdayMatch.index, length: weekdayMatch[0].length } };
  }

  const monthPattern = new RegExp(`\\b(${MONTHS.map((month) => `${month.slice(0, 3)}(?:${month.slice(3)})?`).join("|")})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, "i");
  const monthMatch = monthPattern.exec(text);
  if (monthMatch && monthMatch.index !== undefined) {
    const monthName = monthMatch[1].toLowerCase().replace(/\.$/, "");
    const month = MONTHS.findIndex((value) => value.startsWith(monthName.slice(0, 3)));
    let year = monthMatch[3] ? Number(monthMatch[3]) : now.getFullYear();
    let date = makeLocalDate(year, month, Number(monthMatch[2]));
    if (!date) return null;
    if (!monthMatch[3] && date < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      year += 1;
      date = makeLocalDate(year, month, Number(monthMatch[2]));
    }
    return date ? { date, range: { index: monthMatch.index, length: monthMatch[0].length } } : null;
  }

  const numericMatch = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(text);
  if (numericMatch && numericMatch.index !== undefined) {
    const month = Number(numericMatch[1]) - 1;
    let year = numericMatch[3] ? Number(numericMatch[3]) : now.getFullYear();
    if (numericMatch[3] && numericMatch[3].length <= 2) year += year < 50 ? 2000 : 1900;
    let date = makeLocalDate(year, month, Number(numericMatch[2]));
    if (!date) return null;
    if (!numericMatch[3] && date < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      year += 1;
      date = makeLocalDate(year, month, Number(numericMatch[2]));
    }
    return date ? { date, range: { index: numericMatch.index, length: numericMatch[0].length } } : null;
  }
  return null;
}

function parseTimePhrase(text: string) {
  const twelveHour = /\b(?:at\s*)?(1[0-2]|[1-9])(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)\b/i.exec(text);
  if (twelveHour && twelveHour.index !== undefined) {
    const suffix = twelveHour[3].toLowerCase().startsWith("p") ? 12 : 0;
    const hour = Number(twelveHour[1]) % 12 + suffix;
    return {
      hours: hour,
      minutes: Number(twelveHour[2] ?? 0),
      range: { index: twelveHour.index, length: twelveHour[0].length },
    };
  }

  const twentyFourHour = /\b(?:at\s*)?([01]?\d|2[0-3]):([0-5]\d)\b/.exec(text);
  if (twentyFourHour && twentyFourHour.index !== undefined) {
    return {
      hours: Number(twentyFourHour[1]),
      minutes: Number(twentyFourHour[2]),
      range: { index: twentyFourHour.index, length: twentyFourHour[0].length },
    };
  }
  return null;
}

export function parseQuickCapture(value: string, now = new Date()): ParsedQuickCapture {
  const datePhrase = parseDatePhrase(value, now);
  const timePhrase = parseTimePhrase(value);
  const priorityMatch = /\b(?:priority\s+(low|medium|mid|high)|(low|medium|mid|high)\s+priority)\b/i.exec(value);
  const priorityWord = (priorityMatch?.[1] ?? priorityMatch?.[2] ?? "medium").toLowerCase();
  const priority: TaskPriority = priorityWord === "high" ? "high" : priorityWord === "low" ? "low" : "medium";

  const ranges: TextRange[] = [];
  if (datePhrase) ranges.push(datePhrase.range);
  if (timePhrase) ranges.push(timePhrase.range);
  if (priorityMatch?.index !== undefined) ranges.push({ index: priorityMatch.index, length: priorityMatch[0].length });
  let title = value;
  for (const range of ranges.sort((a, b) => b.index - a.index)) {
    title = `${title.slice(0, range.index)} ${title.slice(range.index + range.length)}`;
  }
  title = title
    .replace(/\b(?:at|on)\b/gi, " ")
    .replace(/[\s,;:]+/g, " ")
    .replace(/^[–—-]+|[–—-]+$/g, "")
    .trim();

  let dueAt: string | null = null;
  if (datePhrase || timePhrase) {
    const date = datePhrase?.date ?? new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const defaultHour = datePhrase?.range && /tonight/i.test(value.slice(datePhrase.range.index, datePhrase.range.index + datePhrase.range.length)) ? 20 : 9;
    date.setHours(timePhrase?.hours ?? defaultHour, timePhrase?.minutes ?? 0, 0, 0);
    dueAt = date.toISOString();
  }

  return { title, dueAt, priority };
}
