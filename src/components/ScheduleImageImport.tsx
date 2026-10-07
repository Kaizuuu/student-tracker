"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ChoicePicker from "@/components/ChoicePicker";
import TimePicker from "@/components/TimePicker";
import type { ClassRecord, SubjectRecord } from "@/types/records";

const DAYS = [
  { value: 1, label: "Monday", aliases: ["monday", "mon"] },
  { value: 2, label: "Tuesday", aliases: ["tuesday", "tue", "tues"] },
  { value: 3, label: "Wednesday", aliases: ["wednesday", "wed"] },
  { value: 4, label: "Thursday", aliases: ["thursday", "thu", "thur", "thurs"] },
  { value: 5, label: "Friday", aliases: ["friday", "fri"] },
  { value: 6, label: "Saturday", aliases: ["saturday", "sat"] },
  { value: 0, label: "Sunday", aliases: ["sunday", "sun"] },
] as const;
const DAY_OPTIONS = DAYS.map((day) => ({ value: String(day.value), label: day.label, marker: day.label.slice(0, 1) }));

type DraftClass = {
  id: string;
  subjectText: string;
  subjectId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string;
  teacher: string;
  needsReview: boolean;
};

type OCRLine = {
  text: string;
  bbox?: { x0: number; x1: number; y0: number; y1: number };
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
  const key = normalizeSubject(text);
  return subjects.find((subject) => normalizeSubject(subject.name) === key);
}

function buildDrafts(lines: OCRLine[], subjects: SubjectRecord[]): DraftClass[] {
  const normalizedLines = lines
    .map((line) => ({ ...line, text: line.text.replace(/\s+/g, " ").trim() }))
    .filter((line) => line.text && /[\p{L}]{2}/u.test(line.text));

  const dayHeaders = normalizedLines.flatMap((line) => {
    const day = dayInText(line.text);
    return day && line.bbox ? [{ dayOfWeek: day.value, x: (line.bbox.x0 + line.bbox.x1) / 2, y: line.bbox.y1 }] : [];
  });
  const timeRows = normalizedLines.flatMap((line) => {
    const range = timeRangeInText(line.text);
    return range && line.bbox ? [{ ...range, y: (line.bbox.y0 + line.bbox.y1) / 2 }] : [];
  });

  const candidates: DraftClass[] = [];
  for (const line of normalizedLines) {
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

    let dayOfWeek = foundDay?.value;
    let inferredRange = range;
    if (line.bbox && dayHeaders.length && !dayOfWeek) {
      const x = (line.bbox.x0 + line.bbox.x1) / 2;
      dayOfWeek = dayHeaders.reduce((closest, header) => Math.abs(header.x - x) < Math.abs(closest.x - x) ? header : closest).dayOfWeek;
    }
    if (line.bbox && timeRows.length && !inferredRange) {
      const y = (line.bbox.y0 + line.bbox.y1) / 2;
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
      dayOfWeek: dayOfWeek ?? 1,
      startTime: inferredRange?.startTime ?? "09:00",
      endTime: inferredRange?.endTime ?? "10:00",
      room: "",
      teacher: "",
      needsReview: !dayOfWeek || !inferredRange || !subject,
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

  const newSubjectNames = useMemo(() => new Set(drafts.filter((draft) => !draft.subjectId).map((draft) => draft.subjectText.trim()).filter(Boolean)), [drafts]);
  const saveableCount = drafts.filter((draft) => draft.subjectText.trim() && draft.startTime < draft.endTime).length;

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function updateDraft(id: string, patch: Partial<DraftClass>) {
    setDrafts((current) => current.map((draft) => {
      if (draft.id !== id) return draft;
      const next = { ...draft, ...patch };
      const matched = matchSubject(next.subjectText, subjects);
      if (patch.subjectId === undefined && patch.subjectText !== undefined) next.subjectId = matched?.id ?? "";
      next.needsReview = !next.subjectId || next.startTime >= next.endTime;
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
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        logger: (message) => {
          if (message.status) setStatus(message.status === "recognizing text" ? "Reading schedule text…" : "Preparing text recognition…");
          if (typeof message.progress === "number") setProgress(Math.round(message.progress * 100));
        },
      });
      try {
        const result = await worker.recognize(image, {}, { text: true, blocks: true });
        setRawText(result.data.text);
        setEditableText(result.data.text);
        const lines = (result.data.blocks ?? []).flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines));
        const parsed = buildDrafts(lines as OCRLine[], subjects);
        if (!parsed.length) {
          setError("No class rows were detected. You can turn the recognized text into editable drafts and fill in the missing details.");
        } else {
          setDrafts(parsed);
          setStatus(`Found ${parsed.length} possible ${parsed.length === 1 ? "class" : "classes"}. Review each one before importing.`);
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
      await onSave(drafts.filter((draft) => draft.subjectText.trim() && draft.startTime < draft.endTime), newSubjectNames);
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
          {image && <span className="max-w-full break-all text-xs text-muted">{image.name}</span>}
          {image && <button type="button" disabled={recognizing} onClick={() => void recognize()} className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-accent">{recognizing ? "Reading…" : drafts.length ? "Read again" : "Read schedule"}</button>}
        </div>
        {previewUrl && <img src={previewUrl} alt="Selected timetable screenshot preview" className="max-h-44 w-full rounded-2xl border border-border bg-background object-contain p-2" />}
      </div>

      {status && <div className="mt-4" role="status"><p className="text-sm text-muted">{status}</p>{progress > 0 && progress < 100 && <div className="mt-2 h-2 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${progress}%` }} /></div>}</div>}
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {rawText && !drafts.length && <div className="mt-4"><label htmlFor="schedule-ocr-text" className="text-sm font-medium">Recognized text <span className="font-normal text-muted">(edit if needed; one class per line)</span></label><textarea id="schedule-ocr-text" rows={5} value={editableText} onChange={(event) => setEditableText(event.target.value)} className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" /><button type="button" onClick={createDraftsFromText} className="mt-2 min-h-10 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-background focus-visible:outline-2 focus-visible:outline-accent">Create editable drafts</button></div>}

      {drafts.length > 0 && <>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
          <div><h3 className="font-semibold">Review detected classes</h3><p className="mt-1 text-sm text-muted">{existingClasses.length ? "Existing entries are marked so you can avoid duplicates." : "Check the subject, day, and times before importing."}</p></div>
          <p className="text-xs text-muted">{drafts.filter((draft) => draft.needsReview).length} need review</p>
        </div>
        <div className="mt-3 space-y-3">
          {drafts.map((draft) => {
            const duplicate = existingClasses.some((item) => item.subjectId === draft.subjectId && item.dayOfWeek === draft.dayOfWeek && item.startTime === draft.startTime);
            return <div key={draft.id} className="rounded-2xl border border-border bg-background p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-medium text-muted">{draft.needsReview ? "Check detected details" : "Ready to import"}</span><button type="button" onClick={() => setDrafts((current) => current.filter((item) => item.id !== draft.id))} className="min-h-9 rounded-lg px-2 text-xs text-muted hover:bg-red-500/10 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-red-500 dark:hover:text-red-300">Remove</button></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-muted">Subject name<input value={draft.subjectText} maxLength={100} onChange={(event) => updateDraft(draft.id, { subjectText: event.target.value })} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" /></label>
                <div><label htmlFor={`import-subject-${draft.id}`} className="block text-xs font-medium text-muted">Link to subject</label><ChoicePicker id={`import-subject-${draft.id}`} value={draft.subjectId || "__new__"} options={[{ value: "__new__", label: `Create “${draft.subjectText || "New subject"}”`, marker: "+", description: "Add this to your subjects" }, ...subjects.map((subject) => ({ value: subject.id, label: subject.name, description: [subject.room, subject.teacher].filter(Boolean).join(" · "), color: subject.color }))]} onChange={(value) => updateDraft(draft.id, { subjectId: value === "__new__" ? "" : value })} /></div>
                <div><label htmlFor={`import-day-${draft.id}`} className="block text-xs font-medium text-muted">Day</label><ChoicePicker id={`import-day-${draft.id}`} value={String(draft.dayOfWeek)} options={DAY_OPTIONS} onChange={(value) => updateDraft(draft.id, { dayOfWeek: Number(value) })} /></div>
                <div className="grid grid-cols-2 gap-2"><div><label htmlFor={`import-start-${draft.id}`} className="block text-xs font-medium text-muted">Starts</label><TimePicker id={`import-start-${draft.id}`} value={draft.startTime} onChange={(startTime) => updateDraft(draft.id, { startTime })} /></div><div><label htmlFor={`import-end-${draft.id}`} className="block text-xs font-medium text-muted">Ends</label><TimePicker id={`import-end-${draft.id}`} value={draft.endTime} onChange={(endTime) => updateDraft(draft.id, { endTime })} /></div></div>
                <label className="text-xs font-medium text-muted">Room (optional)<input value={draft.room} maxLength={60} onChange={(event) => updateDraft(draft.id, { room: event.target.value })} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" /></label>
                <label className="text-xs font-medium text-muted">Teacher (optional)<input value={draft.teacher} maxLength={80} onChange={(event) => updateDraft(draft.id, { teacher: event.target.value })} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" /></label>
              </div>
              {duplicate && <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">This looks like an existing class at the same time.</p>}
            </div>;
          })}
        </div>
        {rawText && <div className="mt-4"><button type="button" aria-expanded={showRaw} onClick={() => setShowRaw(!showRaw)} className="min-h-10 rounded-lg px-2 text-xs font-medium text-accent hover:bg-accent/10">{showRaw ? "Hide" : "Show"} recognized text</button>{showRaw && <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-background p-3 text-xs text-muted">{rawText}</pre>}</div>}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><p className="max-w-lg text-xs leading-5 text-muted">Image recognition runs on your device. OCR assets are downloaded the first time; after reviewing, imported classes are saved to this device.</p><button type="button" disabled={!saveableCount || saving} onClick={() => void save()} className="min-h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Importing…" : `Import ${saveableCount} ${saveableCount === 1 ? "class" : "classes"}`}</button></div>
      </>}
    </div>
  );
}

