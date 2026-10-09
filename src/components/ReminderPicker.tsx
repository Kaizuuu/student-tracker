"use client";

import ChoicePicker from "@/components/ChoicePicker";
import type { ReminderMinutesBefore } from "@/types/records";

const options = [
  { value: "10", label: "10 minutes before", marker: "10", description: "A quick heads-up before it starts" },
  { value: "30", label: "30 minutes before", marker: "30", description: "Time to get ready" },
  { value: "60", label: "1 hour before", marker: "1h", description: "Extra time to plan ahead" },
  { value: "none", label: "No reminder", marker: "×", description: "Turn off all reminders for this item" },
];

export default function ReminderPicker({
  id,
  value,
  onChange,
  disabled = false,
}: {
  id: string;
  value: ReminderMinutesBefore;
  onChange: (value: ReminderMinutesBefore) => void;
  disabled?: boolean;
}) {
  return (
    <div className="min-w-0 w-full max-w-full">
      <label htmlFor={id} className="block text-sm font-medium">Remind me</label>
      <ChoicePicker
        id={id}
        value={value === null ? "none" : value === 1440 ? "10" : String(value)}
        options={options}
        disabled={disabled}
        onChange={(next) => onChange(next === "none" ? null : Number(next) as ReminderMinutesBefore)}
      />
      <p className="mt-1 text-xs leading-5 text-muted">{disabled ? "Add a due date and time to turn on reminders." : "A day-before reminder is automatic. Choose an extra alert or turn all reminders off. Push reminders are checked about every 5 minutes."}</p>
    </div>
  );
}
