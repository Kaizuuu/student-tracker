"use client";

import ChoicePicker from "@/components/ChoicePicker";
import type { ReminderMinutesBefore } from "@/types/records";

const options = [
  { value: "10", label: "10 minutes before", marker: "10", description: "A quick heads-up" },
  { value: "30", label: "30 minutes before", marker: "30", description: "Time to get ready" },
  { value: "60", label: "1 hour before", marker: "1h", description: "Plan ahead" },
  { value: "1440", label: "1 day before", marker: "1d", description: "A reminder the day before" },
  { value: "none", label: "No reminder", marker: "×", description: "Turn off push for this item" },
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
    <div>
      <label htmlFor={id} className="block text-sm font-medium">Remind me</label>
      <ChoicePicker
        id={id}
        value={value === null ? "none" : String(value)}
        options={options}
        disabled={disabled}
        onChange={(next) => onChange(next === "none" ? null : Number(next) as ReminderMinutesBefore)}
      />
      <p className="mt-1 text-xs leading-5 text-muted">{disabled ? "Add a due date and time to turn on this reminder." : "Push reminders are checked about every 5 minutes. Keep your planner synced for reminders to reach your phone."}</p>
    </div>
  );
}
