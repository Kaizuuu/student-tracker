"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ChoicePicker from "@/components/ChoicePicker";
import TimePicker from "@/components/TimePicker";
import type { ClassRecord, SubjectRecord } from "@/types/records";

const DAYS = [
  { value: 1, label: "Monday", short: "Mon", aliases: ["monday", "mon"] },
  { value: 2, label: "Tuesday", short: "Tue", aliases: ["tuesday", "tue", "tues"] },
  { value: 3, label: "Wednesday", short: "Wed", aliases: ["wednesday", "wed"] },
  { value: 4, label: "Thursday", short: "Thu", aliases: ["thursday", "thu", "thur", "thurs"] },
  { value: 5, label: "Friday", short: "Fri", aliases: ["friday", "fri"] },
  { value: 6, label: "Saturday", short: "Sat", aliases: ["saturday", "sat"] },
  { value: 0, label: "Sunday", short: "Sun", aliases: ["sunday", "sun"] },
] as const;
const DAY_OPTIONS = [{ value: "unassigned", label: "Needs a day", marker: "?", description: "Assign this before importing" }, ...DAYS.map((day) => ({ value: String(day.value), label: day.label, marker: day.short.slice(0, 1) }))];

type DraftClass = {
  id: string;
  subjectText: string;
  subjectId: string;
  dayOfWeek: number | null;
  startTime: string;
  endTime: string;
  room: string;
  teacher: string;
  needsReview: boolean;
  selected: boolean;
};

type OCRLine = {
  text: string;
  bbox?: { x0: number; x1: number; y0: number; y1: number };
  words?: Array<{ text: string; bbox: { x0: number; x1: number; y0: number; y1: number } }>;
  assignedDayOfWeek?: number;
};

function dayInText(text: string) {
  const normalized = text.toLowerCase().replace(/[^a-z\s]/g, " ");
  return DAYS.find((day) => day.aliases.some((alias) => new RegExp(`\\b${alias}\\b`).test(normalized)));
}

function parseTime(value: string) {
  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  const meridiem = match[3]?.toLowerCase();
  if (hours > 23 || minutes > 59 || (meridiem && (hours < 1 || hours > 12))) return null;
  if (meridiem === "pm" && hours !== 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function timeRangeInText(text: string) {
  const match = text.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|–|—|to|until)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  if (!match) return null;
  const startTime = parseTime(match[1]);
  let endTime = parseTime(match[2]);
  if (!startTime || !endTime) return null;
  // In common timetables, “9:00–10:00 AM” applies AM to both endpoints.
  if (!/am|pm/i.test(match[1]) && /am|pm/i.test(match[2])) {
    const suffix = match[2].match(/am|pm/i)?.[0];
    const correctedStart = parseTime(`${match[1]} ${suffix}`);
    if (correctedStart) return { startTime: correctedStart, endTime };
  }
  if (endTime <= startTime && !/am|pm/i.test(match[1]) && /pm/i.test(match[2])) {
    const correctedStart = parseTime(`${match[1]} PM`);
    if (correctedStart) return { startTime: correctedStart, endTime };
  }
  return { startTime, endTime };
}

function normalizeSubject(value: string) {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function matchSubject(text: string, subjects: SubjectRecord[]) {
  const key = normalizeSubject(text).replace(/\s+/g, "");
  return subjects.find((subject) => normalizeSubject(subject.name).replace(/\s+/g, "") === key);
}

function classTextBounds(line: OCRLine) {
  const classWords = line.words?.filter((word) => /[\p{L}]{2}/u.test(word.text) && !dayInText(word.text) && !/^(?:am|pm)$/i.test(word.text));
  if (!classWords?.length) return line.bbox;
  return {
    x0: Math.min(...classWords.map((word) => word.bbox.x0)),
    x1: Math.max(...classWords.map((word) => word.bbox.x1)),
    y0: Math.min(...classWords.map((word) => word.bbox.y0)),
    y1: Math.max(...classWords.map((word) => word.bbox.y1)),
  };
}

type GridTime = {
  x: number;
  y: number;
  value?: string;
  range?: { startTime: string; endTime: string };
};

function lineCenterY(line: OCRLine) {
  return line.bbox ? (line.bbox.y0 + line.bbox.y1) / 2 : 0;
}

function subjectTextFromLine(line: OCRLine) {
  const ignored = new Set([
    "weekly", "schedule", "timetable", "class", "classes", "subject", "subjects", "time", "room", "teacher",
    "small", "steps", "build", "big", "progress", "break", "lunch", "recess",
  ]);
  const tokens = line.text.match(/[\p{L}\p{N}]+/gu) ?? [];
  const useful = tokens.filter((token) => {
    const normalized = token.toLocaleLowerCase();
    return /[\p{L}]{2}/u.test(token) && !ignored.has(normalized) && !dayInText(token) && !/^(?:am|pm)$/i.test(token);
  });
  return useful.join(" ").trim();
}

function timesOnLine(line: OCRLine): GridTime[] {
  const range = timeRangeInText(line.text);
  if (range && line.bbox) {
    const timeWords = line.words?.filter((word) => /\d{1,2}(?::\d{2})?/u.test(word.text)) ?? [];
    const x = timeWords.length
      ? timeWords.reduce((sum, word) => sum + (word.bbox.x0 + word.bbox.x1) / 2, 0) / timeWords.length
      : (line.bbox.x0 + line.bbox.x1) / 2;
    return [{ x, y: lineCenterY(line), range }];
  }

  const words = line.words ?? [];
  return words.flatMap((word, index) => {
    const match = word.text.trim().match(/^(\d{1,2}(?::\d{2})?)(am|pm)?$/i);
    if (!match || (!match[1].includes(":") && !match[2])) return [];
    let meridiem = match[2];
    if (!meridiem) {
      const wordY = (word.bbox.y0 + word.bbox.y1) / 2;
      const adjacentMeridiem = words
        .filter((candidate, candidateIndex) => candidateIndex !== index && /^(?:am|pm)$/i.test(candidate.text.trim()))
        .filter((candidate) => Math.abs((candidate.bbox.y0 + candidate.bbox.y1) / 2 - wordY) <= 14)
        .filter((candidate) => Math.abs(candidate.bbox.x0 - word.bbox.x1) <= 36 || Math.abs(word.bbox.x0 - candidate.bbox.x1) <= 36)
        .sort((a, b) => Math.abs(a.bbox.x0 - word.bbox.x1) - Math.abs(b.bbox.x0 - word.bbox.x1))[0];
      meridiem = adjacentMeridiem?.text;
    }
    const value = parseTime(`${match[1]} ${meridiem ?? ""}`);
    return value ? [{ x: (word.bbox.x0 + word.bbox.x1) / 2, y: (word.bbox.y0 + word.bbox.y1) / 2, value }] : [];
  });
}

/** Reads a weekly grid by its horizontal weekday columns and the times beneath each class. */
function buildWeeklyGridDrafts(lines: OCRLine[], subjects: SubjectRecord[]): DraftClass[] | null {
  const timeLines = lines.flatMap((line) => timesOnLine(line));
  if (!timeLines.length) return null;
  const firstTimeY = Math.min(...timeLines.map((time) => time.y));
  const headerLine = lines
    .filter((line) => {
      const words = line.words ?? [];
      if (words.length < 5 || words.length > 7 || lineCenterY(line) >= firstTimeY - 100) return false;
      const xs = words.map((word) => (word.bbox.x0 + word.bbox.x1) / 2);
      return Math.max(...xs) - Math.min(...xs) > 240 && !timeRangeInText(line.text);
    })
    .sort((a, b) => lineCenterY(b) - lineCenterY(a))[0];
  if (!headerLine?.words) return null;

  const headerWords = [...headerLine.words].sort((a, b) => a.bbox.x0 - b.bbox.x0);
  const recognizedDays = headerWords.map((word) => dayInText(word.text)?.value ?? null);
  const allDaysRecognized = recognizedDays.every((day) => day !== null);
  const columnDays = allDaysRecognized
    ? recognizedDays as number[]
    : DAYS.slice(0, headerWords.length).map((day) => day.value);
  const columns = headerWords.map((word, index) => ({
    x: (word.bbox.x0 + word.bbox.x1) / 2,
    dayOfWeek: columnDays[index],
  }));
  const closestColumn = (x: number) => columns.reduce((closest, column) => Math.abs(column.x - x) < Math.abs(closest.x - x) ? column : closest);

  const timeByDay = new Map<number, GridTime[]>();
  for (const time of timeLines) {
    const dayOfWeek = closestColumn(time.x).dayOfWeek;
    const group = timeByDay.get(dayOfWeek) ?? [];
    group.push(time);
    timeByDay.set(dayOfWeek, group);
  }

  const labels = lines.flatMap((line) => {
    if (!line.bbox || timesOnLine(line).length) return [];
    const bounds = classTextBounds(line);
    const subjectText = subjectTextFromLine(line);
    if (!bounds || subjectText.length < 2) return [];
    return [{ subjectText: subjectText.slice(0, 100), x: (bounds.x0 + bounds.x1) / 2, y: (bounds.y0 + bounds.y1) / 2 }];
  }).map((label) => ({ ...label, dayOfWeek: closestColumn(label.x).dayOfWeek }));

  const usedLabels = new Set<string>();
  const drafts: DraftClass[] = [];
  for (const [dayOfWeek, readings] of timeByDay) {
    const ordered = readings.sort((a, b) => a.y - b.y || a.x - b.x);
    const intervals: Array<{ startTime: string; endTime: string; y: number }> = [];
    for (let index = 0; index < ordered.length;) {
      const current = ordered[index];
      if (current.range) {
        intervals.push({ ...current.range, y: current.y });
        index += 1;
        continue;
      }
      const next = ordered[index + 1];
      if (current.value && next?.value && next.y - current.y <= 100) {
        intervals.push({ startTime: current.value, endTime: next.value, y: current.y });
        index += 2;
        continue;
      }
      index += 1;
    }

    for (const interval of intervals) {
      const label = labels
        .filter((candidate) => candidate.dayOfWeek === dayOfWeek && candidate.y < interval.y && interval.y - candidate.y <= 150)
        .filter((candidate) => !usedLabels.has(`${dayOfWeek}:${candidate.y}:${candidate.subjectText}`))
        .sort((a, b) => b.y - a.y)[0];
      if (!label) continue;
      usedLabels.add(`${dayOfWeek}:${label.y}:${label.subjectText}`);
      const subject = matchSubject(label.subjectText, subjects);
      const subjectText = subject?.name ?? label.subjectText;
      const key = `${normalizeSubject(subjectText)}|${dayOfWeek}|${interval.startTime}`;
      if (drafts.some((draft) => `${normalizeSubject(draft.subjectText)}|${draft.dayOfWeek}|${draft.startTime}` === key)) continue;
      drafts.push({
        id: crypto.randomUUID(),
        subjectText,
        subjectId: subject?.id ?? "",
        dayOfWeek,
        startTime: interval.startTime,
        endTime: interval.endTime,
        room: "",
        teacher: "",
        needsReview: !subject || interval.startTime >= interval.endTime,
        selected: true,
      });
    }
  }
  return drafts.slice(0, 40);
}

function buildDrafts(lines: OCRLine[], subjects: SubjectRecord[], useWeeklyGrid = true): DraftClass[] {
  const normalizedLines = lines
    .map((line) => ({ ...line, text: line.text.replace(/\s+/g, " ").trim() }))
    .filter((line) => line.text && /[\p{L}]{2}/u.test(line.text));

  if (useWeeklyGrid) {
    const weeklyGridDrafts = buildWeeklyGridDrafts(normalizedLines, subjects);
    if (weeklyGridDrafts) return weeklyGridDrafts;
  }

  const dayHeaders = normalizedLines.flatMap((line) => {
    const wordHeaders = line.words?.flatMap((word) => {
      const day = dayInText(word.text);
      return day ? [{ dayOfWeek: day.value, x: (word.bbox.x0 + word.bbox.x1) / 2, y: (word.bbox.y0 + word.bbox.y1) / 2 }] : [];
    }) ?? [];
    if (wordHeaders.length) return wordHeaders;
    const day = dayInText(line.text);
    return day && line.bbox ? [{ dayOfWeek: day.value, x: (line.bbox.x0 + line.bbox.x1) / 2, y: (line.bbox.y0 + line.bbox.y1) / 2 }] : [];
  });
  const timeRows = normalizedLines.flatMap((line) => {
    const range = timeRangeInText(line.text);
    return range && line.bbox ? [{ ...range, y: (line.bbox.y0 + line.bbox.y1) / 2 }] : [];
  });
  const headerXSpan = dayHeaders.length > 1 ? Math.max(...dayHeaders.map((header) => header.x)) - Math.min(...dayHeaders.map((header) => header.x)) : 0;
  const headerYSpan = dayHeaders.length > 1 ? Math.max(...dayHeaders.map((header) => header.y)) - Math.min(...dayHeaders.map((header) => header.y)) : 0;
  const daysAreRows = dayHeaders.length > 1 && headerYSpan > headerXSpan * 0.55;

  const candidateLines = !daysAreRows && dayHeaders.length > 1
    ? normalizedLines.flatMap((line) => {
      if (!line.words?.length) return [line];
      const groups = new Map<number, typeof line.words>();
      for (const word of line.words) {
        if (dayInText(word.text)) continue;
        const x = (word.bbox.x0 + word.bbox.x1) / 2;
        const nearestDay = dayHeaders.reduce((closest, header) => Math.abs(header.x - x) < Math.abs(closest.x - x) ? header : closest);
        const group = groups.get(nearestDay.dayOfWeek) ?? [];
        group.push(word);
        groups.set(nearestDay.dayOfWeek, group);
      }
      const splitLines = Array.from(groups, ([assignedDayOfWeek, words]) => {
        const bbox = {
          x0: Math.min(...words.map((word) => word.bbox.x0)),
          x1: Math.max(...words.map((word) => word.bbox.x1)),
          y0: Math.min(...words.map((word) => word.bbox.y0)),
          y1: Math.max(...words.map((word) => word.bbox.y1)),
        };
        return { text: words.map((word) => word.text).join(" "), words, bbox, assignedDayOfWeek };
      }).filter((splitLine) => /[\p{L}]{2}/u.test(splitLine.text));
      return splitLines.length ? splitLines : [];
    })
    : normalizedLines;

  const candidates: DraftClass[] = [];
  for (const line of candidateLines) {
    const bounds = classTextBounds(line);
    const range = timeRangeInText(line.text);
    const foundDay = dayInText(line.text);
    const stripped = line.text
      .replace(/\b(?:monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat|sunday|sun)\b/gi, " ")
      .replace(/\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:-|–|—|to|until)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?/gi, " ")
      .replace(/[|•·]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (stripped.length < 2 || !/[\p{L}]{2}/u.test(stripped)) continue;
    // Skip labels, legends, and common timetable headings.
    if (/^(schedule|timetable|class schedule|subject|subjects|time|room|teacher|break|lunch|recess)$/i.test(stripped)) continue;

    let dayOfWeek = line.assignedDayOfWeek ?? foundDay?.value;
    let inferredRange = range;
    if (bounds && dayHeaders.length && dayOfWeek === undefined) {
      const x = (bounds.x0 + bounds.x1) / 2;
      const y = (bounds.y0 + bounds.y1) / 2;
      if (daysAreRows) {
        const precedingHeaders = dayHeaders.filter((header) => header.y <= y);
        if (precedingHeaders.length) dayOfWeek = precedingHeaders.reduce((latest, header) => header.y > latest.y ? header : latest).dayOfWeek;
      } else {
        dayOfWeek = dayHeaders.reduce((closest, header) => Math.abs(header.x - x) < Math.abs(closest.x - x) ? header : closest).dayOfWeek;
      }
    }
    if (bounds && timeRows.length && !inferredRange) {
      const y = (bounds.y0 + bounds.y1) / 2;
      const priorRows = timeRows.filter((row) => row.y <= y + 8);
      const nearest = (priorRows.length ? priorRows : timeRows).reduce((closest, row) => Math.abs(row.y - y) < Math.abs(closest.y - y) ? row : closest);
      inferredRange = { startTime: nearest.startTime, endTime: nearest.endTime };
    }

    const subject = matchSubject(stripped, subjects);
    const key = `${normalizeSubject(stripped)}|${dayOfWeek ?? "?"}|${inferredRange?.startTime ?? "?"}`;
    if (candidates.some((candidate) => `${normalizeSubject(candidate.subjectText)}|${candidate.dayOfWeek}|${candidate.startTime}` === key)) continue;

    candidates.push({
      id: crypto.randomUUID(),
      subjectText: stripped.slice(0, 100),
      subjectId: subject?.id ?? "",
      dayOfWeek: dayOfWeek ?? null,
      startTime: inferredRange?.startTime ?? "09:00",
      endTime: inferredRange?.endTime ?? "10:00",
      room: "",
      teacher: "",
      needsReview: dayOfWeek === undefined || !inferredRange || !subject,
      selected: true,
    });
  }
  return candidates.slice(0, 40);
}

interface ScheduleImageImportProps {
  subjects: SubjectRecord[];
  existingClasses: ClassRecord[];
  onClose: () => void;
  onSave: (drafts: DraftClass[], newSubjectNames: Set<string>) => Promise<void>;
}

export default function ScheduleImageImport({ subjects, existingClasses, onClose, onSave }: ScheduleImageImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [drafts, setDrafts] = useState<DraftClass[]>([]);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [rawText, setRawText] = useState("");
  const [editableText, setEditableText] = useState("");
  const [saving, setSaving] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [activeDay, setActiveDay] = useState("1");
  const [editingId, setEditingId] = useState<string | null>(null);

  const newSubjectNames = useMemo(() => new Set(drafts.filter((draft) => draft.selected && draft.dayOfWeek !== null && draft.subjectText.trim() && draft.startTime < draft.endTime && !draft.subjectId).map((draft) => draft.subjectText.trim())), [drafts]);
  const saveableCount = drafts.filter((draft) => draft.selected && draft.subjectText.trim() && draft.dayOfWeek !== null && draft.startTime < draft.endTime).length;
  const activeDayDrafts = drafts.filter((draft) => (draft.dayOfWeek === null ? "unassigned" : String(draft.dayOfWeek)) === activeDay);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function updateDraft(id: string, patch: Partial<DraftClass>) {
    setDrafts((current) => current.map((draft) => {
      if (draft.id !== id) return draft;
      const next = { ...draft, ...patch };
      const matched = matchSubject(next.subjectText, subjects);
      if (patch.subjectId === undefined && patch.subjectText !== undefined) next.subjectId = matched?.id ?? "";
      next.needsReview = next.dayOfWeek === null || !next.subjectText.trim() || next.startTime >= next.endTime;
      return next;
    }));
  }

  async function recognize() {
    if (!image) return;
    setRecognizing(true);
    setError("");
    setStatus("Loading on-device text recognition…");
    setProgress(0);
    try {
      const { createWorker, PSM } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        logger: (message) => {
          if (message.status) setStatus(message.status === "recognizing text" ? "Reading schedule text…" : "Preparing text recognition…");
          if (typeof message.progress === "number") setProgress(Math.round(message.progress * 100));
        },
      });
      try {
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
        const result = await worker.recognize(image, {}, { text: true, blocks: true });
        setRawText(result.data.text);
        setEditableText(result.data.text);
        const lines = (result.data.blocks ?? []).flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines));
        const normalizedLines = (lines as OCRLine[]).map((line) => ({ ...line, text: line.text.replace(/\s+/g, " ").trim() }));
        const weeklyGridDrafts = buildWeeklyGridDrafts(normalizedLines, subjects);
        const parsed = weeklyGridDrafts ?? buildDrafts(normalizedLines, subjects, false);
        if (!parsed.length) {
          setError("No class rows were detected. You can turn the recognized text into editable drafts and fill in the missing details.");
        } else {
          setDrafts(parsed);
          setActiveDay(String(parsed.find((draft) => draft.dayOfWeek !== null)?.dayOfWeek ?? "unassigned"));
          setEditingId(null);
          setStatus(weeklyGridDrafts
            ? `Mapped ${parsed.length} ${parsed.length === 1 ? "class" : "classes"} from the weekday columns. Review the day, time, and subject before importing.`
            : `Found ${parsed.length} possible ${parsed.length === 1 ? "class" : "classes"}. Review each one before importing.`);
        }
      } finally {
        await worker.terminate();
      }
    } catch {
      setError("Text recognition couldn't start. Check your connection for the first use, then try again.");
      setStatus("");
    } finally {
      setRecognizing(false);
    }
  }

  async function save() {
    if (!saveableCount) return;
    setSaving(true);
    setError("");
    try {
      await onSave(drafts.filter((draft) => draft.selected && draft.subjectText.trim() && draft.dayOfWeek !== null && draft.startTime < draft.endTime), newSubjectNames);
    } catch {
      setError("The schedule could not be saved. Your review is still here; try again.");
    } finally {
      setSaving(false);
    }
  }

  function createDraftsFromText() {
    const lines = editableText.split(/\r?\n/).map((text) => ({ text }));
    const parsed = buildDrafts(lines, subjects);
    if (!parsed.length) {
      setError("There isn't any class text to use yet. Add one class name per line, then try again.");
      return;
    }
    setDrafts(parsed);
    // Default to the first detected day so tabs stay synced with the content.
    const firstDayDraft = parsed.find((draft) => draft.dayOfWeek !== null);
    setActiveDay(firstDayDraft ? String(firstDayDraft.dayOfWeek) : "unassigned");
    setEditingId(null);
    setError("");
    setStatus(`Created ${parsed.length} editable ${parsed.length === 1 ? "draft" : "drafts"}. Check the day and time for each.`);
  }

  function selectImage(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file such as PNG, JPG, or HEIC.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError("Choose an image smaller than 12 MB.");
      return;
    }
    setImage(file);
    setPreviewUrl(URL.createObjectURL(file));
    setDrafts([]);
    setRawText("");
    setError("");
    setStatus("");
  }

  return (
    <div className="mt-8 rounded-3xl border border-border bg-surface p-5 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Schedule import</p>
          <h2 className="mt-1 text-xl font-semibold">Import from a screenshot</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Choose a clear timetable image. We’ll read it in your browser and prepare editable class entries. Nothing is added until you review and confirm.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close schedule import" className="min-h-11 shrink-0 rounded-xl px-3 text-sm font-medium text-muted hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">Close</button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <div className="flex flex-wrap items-center gap-3">
          <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={(event) => selectImage(event.target.files?.[0])} />
          <button type="button" onClick={() => inputRef.current?.click()} className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-background focus-visible:outline-2 focus-visible:outline-accent">{image ? "Choose another image" : "Choose screenshot"}</button>
          {image && <span className="max-w-full truncate text-xs text-muted">{image.name}</span>}
          {image && <button type="button" disabled={recognizing} onClick={() => void recognize()} className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-accent">{recognizing ? "Reading…" : drafts.length ? "Read again" : "Read schedule"}</button>}
        </div>
        {previewUrl && <img src={previewUrl} alt="Selected timetable screenshot preview" className="max-h-44 w-full rounded-2xl border border-border bg-background object-contain p-2" />}
      </div>

      {status && <div className="mt-4" role="status"><p className="text-sm text-muted">{status}</p>{progress > 0 && progress < 100 && <div className="mt-2 h-2 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${progress}%` }} /></div>}</div>}
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {rawText && !drafts.length && <div className="mt-4 min-w-0"><label htmlFor="schedule-ocr-text" className="block text-sm font-medium">Recognized text <span className="font-normal text-muted">(edit if needed; one class per line)</span></label><textarea id="schedule-ocr-text" rows={5} value={editableText} onChange={(event) => setEditableText(event.target.value)} className="mt-2 min-h-0 min-w-0 w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 break-words" /><button type="button" onClick={createDraftsFromText} className="mt-2 min-h-10 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-background focus-visible:outline-2 focus-visible:outline-accent">Create editable drafts</button></div>}

      {drafts.length > 0 && <>
        <div className="mt-6 flex min-w-0 flex-wrap items-end justify-between gap-3">
          <div className="min-w-0"><h3 className="font-semibold">Review by weekday</h3><p className="mt-1 max-w-full text-sm leading-5 text-muted">Open each day, check the classes you want, and edit details only when needed.</p></div>
          <p className="shrink-0 text-xs text-muted">{drafts.filter((draft) => draft.needsReview).length} need a check</p>
        </div>
        <div role="tablist" aria-label="Schedule weekdays" className="mt-4 flex min-w-0 gap-2 overflow-x-auto overscroll-x-contain pb-2">
          {DAYS.map((day) => {
            const value = String(day.value);
            const count = drafts.filter((draft) => draft.dayOfWeek === day.value).length;
            const active = activeDay === value;
            return <button key={value} type="button" role="tab" aria-selected={active} onClick={() => { setActiveDay(value); setEditingId(null); }} className={`flex min-h-16 min-w-[4.5rem] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border px-3 transition-colors focus-visible:outline-2 focus-visible:outline-accent ${active ? "border-accent bg-accent text-accent-foreground shadow-sm" : "border-border bg-background text-muted hover:border-accent/40 hover:bg-surface"}`}><span className="text-xs font-semibold">{day.short}</span><span className={`text-[10px] ${active ? "text-accent-foreground/80" : "text-muted"}`}>{count} {count === 1 ? "class" : "classes"}</span></button>;
          })}
          {drafts.some((draft) => draft.dayOfWeek === null) && <button type="button" role="tab" aria-selected={activeDay === "unassigned"} onClick={() => { setActiveDay("unassigned"); setEditingId(null); }} className={`flex min-h-16 min-w-[5.5rem] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border px-3 focus-visible:outline-2 focus-visible:outline-accent ${activeDay === "unassigned" ? "border-amber-500 bg-amber-500/10 text-amber-800 dark:text-amber-200" : "border-border bg-background text-muted hover:bg-surface"}`}><span className="text-xs font-semibold">Needs day</span><span className="text-[10px]">{drafts.filter((draft) => draft.dayOfWeek === null).length} to assign</span></button>}
        </div>
        <section role="tabpanel" className="mt-2 min-w-0 rounded-2xl border border-border bg-background p-3 sm:p-4">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-border pb-3"><div className="min-w-0"><h4 className="font-semibold">{activeDay === "unassigned" ? "Needs a day" : DAYS.find((day) => String(day.value) === activeDay)?.label}</h4><p className="mt-0.5 text-xs text-muted">{activeDayDrafts.filter((draft) => draft.selected).length} of {activeDayDrafts.length} selected</p></div><div className="flex shrink-0 gap-1"><button type="button" onClick={() => setDrafts((current) => current.map((draft) => (draft.dayOfWeek === null ? "unassigned" : String(draft.dayOfWeek)) === activeDay ? { ...draft, selected: true } : draft))} className="min-h-9 rounded-lg px-2 text-xs font-semibold text-accent hover:bg-accent/10">Select all</button><button type="button" onClick={() => setDrafts((current) => current.map((draft) => (draft.dayOfWeek === null ? "unassigned" : String(draft.dayOfWeek)) === activeDay ? { ...draft, selected: false } : draft))} className="min-h-9 rounded-lg px-2 text-xs font-medium text-muted hover:bg-surface">Clear</button></div></div>
          {activeDayDrafts.length === 0 ? <p className="px-2 py-7 text-center text-sm text-muted">No detected classes for this day.</p> : <ul className="mt-3 space-y-2">
            {activeDayDrafts.map((draft) => {
              const linkedSubject = subjects.find((subject) => subject.id === draft.subjectId) ?? matchSubject(draft.subjectText, subjects);
              const isEditing = editingId === draft.id;
              return <li key={draft.id} className="min-w-0 rounded-xl border border-border bg-surface p-3 sm:p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <input type="checkbox" checked={draft.selected} onChange={(event) => updateDraft(draft.id, { selected: event.target.checked })} aria-label={`Import ${draft.subjectText} on ${draft.dayOfWeek === null ? "an unassigned day" : DAYS.find((day) => day.value === draft.dayOfWeek)?.label}`} className="mt-1 size-5 shrink-0 accent-[var(--accent)]" />
                  <div className="min-w-0 flex-1 overflow-hidden"><p className="truncate font-semibold leading-5">{draft.subjectText || "Unnamed class"}</p><p className="mt-1 truncate text-xs leading-5 text-muted">{draft.dayOfWeek === null ? "Choose a day" : DAYS.find((day) => day.value === draft.dayOfWeek)?.label} · {draft.needsReview ? "Check time and subject" : `${draft.startTime}–${draft.endTime}`}</p><p className="mt-1 truncate text-xs text-muted">{linkedSubject ? `Matches ${linkedSubject.name}` : `Will create subject ${draft.subjectText || "from this name"}`}</p></div>
                  <button type="button" aria-expanded={isEditing} onClick={() => setEditingId(isEditing ? null : draft.id)} className="min-h-9 shrink-0 rounded-lg px-2 text-xs font-semibold text-accent hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent">{isEditing ? "Done" : "Edit"}</button>
                </div>
                {isEditing && <div className="mt-4 grid min-w-0 gap-3 border-t border-border pt-3 sm:grid-cols-2">
                  <div className="min-w-0"><label htmlFor={`import-name-${draft.id}`} className="block text-xs font-medium text-muted">Class or subject name</label><input id={`import-name-${draft.id}`} value={draft.subjectText} maxLength={100} onChange={(event) => updateDraft(draft.id, { subjectText: event.target.value })} className="mt-1 min-h-11 min-w-0 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" /></div>
                  <div className="min-w-0"><label htmlFor={`import-subject-${draft.id}`} className="block text-xs font-medium text-muted">Subject</label><ChoicePicker id={`import-subject-${draft.id}`} value={draft.subjectId || "__new__"} options={[{ value: "__new__", label: "Create a new subject", marker: "+", description: "Use the name above" }, ...subjects.map((subject) => ({ value: subject.id, label: subject.name, description: [subject.room, subject.teacher].filter(Boolean).join(" · "), color: subject.color }))]} onChange={(value) => updateDraft(draft.id, { subjectId: value === "__new__" ? "" : value })} /></div>
                  <div className="min-w-0"><label htmlFor={`import-day-${draft.id}`} className="block text-xs font-medium text-muted">Day</label><ChoicePicker id={`import-day-${draft.id}`} value={draft.dayOfWeek === null ? "unassigned" : String(draft.dayOfWeek)} options={DAY_OPTIONS} onChange={(value) => { const dayOfWeek = value === "unassigned" ? null : Number(value); updateDraft(draft.id, { dayOfWeek }); setEditingId(null); setActiveDay(value); }} /></div>
                  <div className="grid min-w-0 grid-cols-1 gap-2 min-[420px]:grid-cols-2"><div className="min-w-0"><label htmlFor={`import-start-${draft.id}`} className="block text-xs font-medium text-muted">Starts</label><TimePicker id={`import-start-${draft.id}`} value={draft.startTime} onChange={(startTime) => updateDraft(draft.id, { startTime })} /></div><div className="min-w-0"><label htmlFor={`import-end-${draft.id}`} className="block text-xs font-medium text-muted">Ends</label><TimePicker id={`import-end-${draft.id}`} value={draft.endTime} onChange={(endTime) => updateDraft(draft.id, { endTime })} /></div></div>
                  <div className="min-w-0"><label htmlFor={`import-room-${draft.id}`} className="block text-xs font-medium text-muted">Room (optional)</label><input id={`import-room-${draft.id}`} value={draft.room} maxLength={60} onChange={(event) => updateDraft(draft.id, { room: event.target.value })} placeholder="Room" className="mt-1 min-h-11 min-w-0 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" /></div>
                  <div className="min-w-0"><label htmlFor={`import-teacher-${draft.id}`} className="block text-xs font-medium text-muted">Teacher (optional)</label><input id={`import-teacher-${draft.id}`} value={draft.teacher} maxLength={80} onChange={(event) => updateDraft(draft.id, { teacher: event.target.value })} placeholder="Teacher" className="mt-1 min-h-11 min-w-0 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" /></div>
                </div>}
              </li>;
            })}
          </ul>}
        </section>
        {rawText && <div className="mt-4"><button type="button" aria-expanded={showRaw} onClick={() => setShowRaw(!showRaw)} className="min-h-10 rounded-lg px-2 text-xs font-medium text-accent hover:bg-accent/10">{showRaw ? "Hide" : "Show"} recognized text</button>{showRaw && <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-background p-3 text-xs text-muted">{rawText}</pre>}</div>}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><p className="max-w-lg text-xs leading-5 text-muted">Image recognition runs on your device. OCR assets are downloaded the first time; after reviewing, imported classes are saved to this device.</p><button type="button" disabled={!saveableCount || saving} onClick={() => void save()} className="min-h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Importing…" : `Import ${saveableCount} ${saveableCount === 1 ? "class" : "classes"}`}</button></div>
      </>}
    </div>
  );
}
