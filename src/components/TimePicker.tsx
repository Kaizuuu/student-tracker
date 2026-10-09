"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function decodeTime(value: string) {
  const [hourText, minuteText] = (value || "09:00").split(":");
  const hour24 = Math.max(0, Math.min(23, Number(hourText) || 0));
  return {
    hour: hour24 % 12 || 12,
    minute: Math.max(0, Math.min(59, Number(minuteText) || 0)),
    period: hour24 >= 12 ? "PM" : "AM",
  } as const;
}

function formatDisplay(value: string) {
  const { hour, minute, period } = decodeTime(value);
  return `${hour}:${String(minute).padStart(2, "0")} ${period}`;
}

interface TimePickerProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function TimePicker({ id, value, onChange, disabled = false }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => decodeTime(value));
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const minutes = useMemo(() => Array.from(new Set([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, decodeTime(value).minute])).sort((a, b) => a - b), [value]);

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

  function openPicker() {
    setDraft(decodeTime(value));
    setOpen((current) => !current);
  }

  function saveTime() {
    const hour12 = draft.hour % 12;
    const hour24 = hour12 + (draft.period === "PM" ? 12 : 0);
    onChange(`${String(hour24).padStart(2, "0")}:${String(draft.minute).padStart(2, "0")}`);
    setOpen(false);
  }

  return <div ref={rootRef} className="relative mt-2 min-w-0 w-full max-w-full">
    <button ref={triggerRef} id={id} type="button" disabled={disabled} aria-haspopup="dialog" aria-expanded={open} onClick={openPicker} className={`group flex min-h-12 w-full items-center gap-3 rounded-2xl border bg-surface px-3.5 text-left shadow-[0_2px_8px_rgb(34_78_108_/_4%)] outline-none transition-[border-color,box-shadow,background-color] hover:border-accent/40 hover:bg-background/60 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/10 disabled:cursor-not-allowed disabled:opacity-60 ${open ? "border-accent/50 ring-4 ring-accent/10" : "border-border"}`}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent" aria-hidden="true"><svg className="size-4" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.6"/><path d="M10 5.8V10l2.8 1.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
      <span className="min-w-0 flex-1"><span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Selected time</span><span className="mt-0.5 block font-semibold tabular-nums text-foreground">{formatDisplay(value)}</span></span>
      <svg className={`size-4 shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180 text-accent" : "group-hover:text-foreground"}`} viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>

    {open && <div role="dialog" aria-label="Choose a time" className="absolute right-0 top-[calc(100%+0.55rem)] z-50 w-[min(20rem,calc(100vw-3rem))] rounded-3xl border border-border bg-surface p-4 shadow-[0_18px_45px_rgb(27_58_78_/_18%)]">
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-accent/8 px-3 py-2.5">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Set your time</p><p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{draft.hour}:{String(draft.minute).padStart(2, "0")} <span className="text-base text-accent">{draft.period}</span></p></div>
        <div className="flex rounded-xl border border-border bg-background p-1" role="group" aria-label="AM or PM">
          {(["AM", "PM"] as const).map((period) => <button key={period} type="button" aria-pressed={draft.period === period} onClick={() => setDraft({ ...draft, period })} className={`min-h-9 min-w-12 rounded-lg px-2 text-xs font-bold transition-colors ${draft.period === period ? "bg-accent text-accent-foreground shadow-sm" : "text-muted hover:text-foreground"}`}>{period}</button>)}
        </div>
      </div>

      <fieldset className="mt-4"><legend className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">Hour</legend><div className="grid grid-cols-4 gap-1.5">
        {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((hour) => <button key={hour} type="button" aria-pressed={draft.hour === hour} onClick={() => setDraft({ ...draft, hour })} className={`min-h-10 rounded-xl text-sm font-semibold tabular-nums transition-colors ${draft.hour === hour ? "bg-accent text-accent-foreground shadow-sm" : "bg-background text-foreground hover:bg-accent/10"}`}>{hour}</button>)}
      </div></fieldset>

      <fieldset className="mt-4"><legend className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">Minute</legend><div className="grid grid-cols-4 gap-1.5">
        {minutes.map((minute) => <button key={minute} type="button" aria-pressed={draft.minute === minute} onClick={() => setDraft({ ...draft, minute })} className={`min-h-9 rounded-xl text-xs font-semibold tabular-nums transition-colors ${draft.minute === minute ? "bg-accent/15 text-accent ring-1 ring-accent/30" : "bg-background text-foreground hover:bg-accent/10"}`}>:{String(minute).padStart(2, "0")}</button>)}
      </div></fieldset>

      <div className="mt-4 flex gap-2 border-t border-border pt-3"><button type="button" onClick={() => setOpen(false)} className="min-h-10 flex-1 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-background">Cancel</button><button type="button" onClick={saveTime} className="min-h-10 flex-1 rounded-xl bg-accent px-3 text-sm font-semibold text-accent-foreground shadow-sm hover:opacity-90">Set time</button></div>
    </div>}
  </div>;
}
