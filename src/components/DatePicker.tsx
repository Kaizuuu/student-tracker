"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";

function parseDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function toDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

interface DatePickerProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
  required?: boolean;
}

export default function DatePicker({ id, value, onChange, placeholder = "Choose a date", allowClear = false, disabled = false, required = false }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => new Date(2000, 0, 1));
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedDate = parseDate(value);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggle() {
    if (!open) {
      const selected = parseDate(value);
      const anchor = selected ?? new Date();
      setViewMonth(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
    }
    setOpen((current) => !current);
  }

  const monthStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const mondayOffset = (monthStart.getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, index) => new Date(viewMonth.getFullYear(), viewMonth.getMonth(), index - mondayOffset + 1));
  const todayValue = toDateValue(new Date());

  return <div ref={rootRef} className="relative mt-2">
    <button ref={triggerRef} id={id} type="button" disabled={disabled} aria-required={required || undefined} aria-haspopup="dialog" aria-expanded={open} onClick={toggle} className={`group flex min-h-12 w-full items-center gap-3 rounded-2xl border bg-surface px-3.5 text-left shadow-[0_2px_8px_rgb(34_78_108_/_4%)] outline-none transition-[border-color,box-shadow,background-color] hover:border-accent/40 hover:bg-background/60 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/10 disabled:cursor-not-allowed disabled:opacity-60 ${open ? "border-accent/50 ring-4 ring-accent/10" : "border-border"}`}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent" aria-hidden="true"><svg className="size-4" viewBox="0 0 20 20" fill="none"><rect x="3" y="4.5" width="14" height="12" rx="2.4" stroke="currentColor" strokeWidth="1.6"/><path d="M6.5 3v3M13.5 3v3M3.5 8h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><path d="M6.5 11h.01M10 11h.01M13.5 11h.01M6.5 14h.01M10 14h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg></span>
      <span className="min-w-0 flex-1"><span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Selected date</span><span className={`mt-0.5 block truncate font-semibold ${selectedDate ? "text-foreground" : "text-muted"}`}>{selectedDate ? format(selectedDate, "EEE, MMM d, yyyy") : placeholder}</span></span>
      <svg className={`size-4 shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180 text-accent" : "group-hover:text-foreground"}`} viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>

    {open && <div role="dialog" aria-label="Choose a date" className="absolute right-0 top-[calc(100%+0.55rem)] z-50 w-[min(20rem,calc(100vw-3rem))] rounded-3xl border border-border bg-surface p-4 shadow-[0_18px_45px_rgb(27_58_78_/_18%)]">
      <div className="flex items-center justify-between gap-2">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Pick a day</p><h3 className="mt-0.5 text-lg font-semibold">{format(viewMonth, "MMMM yyyy")}</h3></div>
        <div className="flex gap-1"><button type="button" aria-label="Previous month" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))} className="flex size-10 items-center justify-center rounded-xl text-muted hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"><svg className="size-4" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m12 4-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></button><button type="button" aria-label="Next month" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))} className="flex size-10 items-center justify-center rounded-xl text-muted hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"><svg className="size-4" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m8 4 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></button></div>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1" role="grid" aria-label={format(viewMonth, "MMMM yyyy")}>
        {WEEKDAY_LABELS.map((label, index) => <span key={`${label}-${index}`} role="columnheader" aria-label={["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][index]} className="flex h-8 items-center justify-center text-[10px] font-bold uppercase text-muted">{label}</span>)}
        {cells.map((date) => {
          const dateValue = toDateValue(date);
          const currentMonth = date.getMonth() === viewMonth.getMonth();
          const isSelected = dateValue === value;
          const isToday = dateValue === todayValue;
          return <button key={dateValue} type="button" role="gridcell" aria-selected={isSelected} aria-label={format(date, "EEEE, MMMM d, yyyy")} onClick={() => { onChange(dateValue); setOpen(false); triggerRef.current?.focus(); }} className={`relative flex aspect-square min-h-9 items-center justify-center rounded-xl text-sm tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-accent ${isSelected ? "bg-accent font-bold text-accent-foreground shadow-sm" : currentMonth ? "text-foreground hover:bg-accent/10" : "text-muted/55 hover:bg-background"} ${isToday && !isSelected ? "font-bold text-accent after:absolute after:bottom-1 after:size-1 after:rounded-full after:bg-accent" : ""}`}>{date.getDate()}</button>;
        })}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3"><button type="button" onClick={() => { const now = new Date(); const today = toDateValue(now); onChange(today); setViewMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setOpen(false); }} className="min-h-10 rounded-xl px-3 text-sm font-semibold text-accent hover:bg-accent/10">Today</button>{allowClear && value && <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="min-h-10 rounded-xl px-3 text-sm font-medium text-muted hover:bg-background">Clear date</button>}</div>
    </div>}
  </div>;
}
