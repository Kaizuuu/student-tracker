export interface CalendarExportItem {
  id: string;
  title: string;
  startsAt: string;
  endsAt?: string | null;
  description?: string;
  location?: string;
}

function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function formatIcsDate(value: Date) {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function foldLine(line: string) {
  const encoder = new TextEncoder();
  const lines: string[] = [];
  let current = "";
  let byteLength = 0;

  for (const character of line) {
    const characterBytes = encoder.encode(character).length;
    if (byteLength + characterBytes > 75) {
      lines.push(current);
      current = " ";
      byteLength = 1;
    }
    current += character;
    byteLength += characterBytes;
  }

  lines.push(current);
  return lines.join("\r\n");
}

function safeFileName(title: string) {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `${slug || "calendar-item"}.ics`;
}

export function downloadCalendarItem(item: CalendarExportItem) {
  const start = new Date(item.startsAt);
  if (Number.isNaN(start.getTime())) throw new Error("This item has no valid date and time.");

  const requestedEnd = item.endsAt ? new Date(item.endsAt) : null;
  const end = requestedEnd && !Number.isNaN(requestedEnd.getTime()) && requestedEnd > start
    ? requestedEnd
    : new Date(start.getTime() + 30 * 60_000);
  const now = new Date();
  const reminderDescription = `Reminder: ${item.title}`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Student Tracker//Calendar Export//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${item.id}@student-tracker.local`,
    `DTSTAMP:${formatIcsDate(now)}`,
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${escapeText(item.title)}`,
    ...(item.description ? [`DESCRIPTION:${escapeText(item.description)}`] : []),
    ...(item.location ? [`LOCATION:${escapeText(item.location)}`] : []),
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(reminderDescription)}`,
    "TRIGGER:-P1D",
    "END:VALARM",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(reminderDescription)}`,
    "TRIGGER:-PT1H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const content = `${lines.map(foldLine).join("\r\n")}\r\n`;
  const file = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeFileName(item.title);
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
