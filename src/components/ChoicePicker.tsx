"use client";

import { useEffect, useRef, useState } from "react";

export interface ChoiceOption {
  value: string;
  label: string;
  description?: string;
  color?: string;
  marker?: string;
}

interface ChoicePickerProps {
  id: string;
  value: string;
  options: ChoiceOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function ChoicePicker({ id, value, options, onChange, placeholder = "Choose an option", disabled = false }: ChoicePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selected = options.find((option) => option.value === value);
  const listId = `${id}-choices`;

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

  function showOptions(index: number) {
    if (disabled) return;
    setOpen(true);
    requestAnimationFrame(() => optionRefs.current[Math.max(0, index)]?.focus());
  }

  function moveFocus(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const next = (index + (event.key === "ArrowDown" ? 1 : options.length - 1)) % options.length;
    optionRefs.current[next]?.focus();
  }

  return (
    <div ref={rootRef} className="relative mt-2 min-w-0 w-full max-w-full">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const currentIndex = options.findIndex((option) => option.value === value);
            showOptions(currentIndex < 0 ? 0 : currentIndex);
          }
        }}
        className={`group flex min-h-12 w-full items-center gap-3 rounded-2xl border bg-surface px-3.5 text-left text-sm shadow-[0_2px_8px_rgb(34_78_108_/_4%)] outline-none transition-[border-color,box-shadow,background-color] hover:border-accent/40 hover:bg-background/60 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/10 disabled:cursor-not-allowed disabled:opacity-60 ${open ? "border-accent/50 ring-4 ring-accent/10" : "border-border"}`}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-sm font-semibold text-accent" style={selected?.color ? { color: selected.color, backgroundColor: `${selected.color}18` } : undefined} aria-hidden="true">
          {selected?.marker ?? <span className="size-2.5 rounded-full bg-current" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate font-semibold ${selected ? "text-foreground" : "text-muted"}`}>{selected?.label ?? placeholder}</span>
          {selected?.description && <span className="mt-0.5 block truncate text-xs font-normal text-muted">{selected.description}</span>}
        </span>
        <svg className={`size-4 shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180 text-accent" : "group-hover:text-foreground"}`} viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>

      {open && <div id={listId} role="listbox" aria-labelledby={id} className="picker-pop-in absolute inset-x-0 top-[calc(100%+0.55rem)] z-50 max-h-72 overflow-y-auto rounded-2xl border border-border bg-surface p-1.5 shadow-[0_18px_45px_rgb(27_58_78_/_18%)] overscroll-contain">
        {options.map((option, index) => {
          const isSelected = option.value === value;
          return <button
            key={option.value}
            ref={(element) => { optionRefs.current[index] = element; }}
            type="button"
            role="option"
            aria-selected={isSelected}
            data-picker-option="true"
            onKeyDown={(event) => moveFocus(event, index)}
            onClick={() => {
              onChange(option.value);
              setOpen(false);
              triggerRef.current?.focus();
            }}
            className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${isSelected ? "bg-accent/10" : "hover:bg-background"}`}
          >
            <span className={`flex size-8 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ${isSelected ? "bg-accent/15 text-accent" : "bg-background text-muted"}`} style={option.color ? { color: option.color, backgroundColor: `${option.color}18` } : undefined} aria-hidden="true">
              {option.marker ?? <span className="size-2.5 rounded-full bg-current" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">{option.label}</span>
              {option.description && <span className="mt-0.5 block truncate text-xs text-muted">{option.description}</span>}
            </span>
            {isSelected && <svg className="mr-1 size-4 shrink-0 text-accent" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m4 10 4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </button>;
        })}
      </div>}
    </div>
  );
}
