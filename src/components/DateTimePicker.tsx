"use client";

import { useEffect, useState } from "react";
import DatePicker from "@/components/DatePicker";
import TimePicker from "@/components/TimePicker";

interface DateTimePickerProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

export default function DateTimePicker({ id, value, onChange, required = false }: DateTimePickerProps) {
  const [date, setDate] = useState(value.slice(0, 10));
  const [time, setTime] = useState(value.length >= 16 ? value.slice(11, 16) : "09:00");

  useEffect(() => {
    setDate(value.slice(0, 10));
    setTime(value.length >= 16 ? value.slice(11, 16) : "09:00");
  }, [value]);

  function changeDate(nextDate: string) {
    setDate(nextDate);
    onChange(nextDate ? `${nextDate}T${time}` : "");
  }

  function changeTime(nextTime: string) {
    setTime(nextTime);
    if (date) onChange(`${date}T${nextTime}`);
  }

  return <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
    <div><label htmlFor={`${id}-date`} className="block text-xs font-semibold uppercase tracking-[0.12em] text-muted">Date{required ? " · required" : ""}</label><DatePicker id={`${id}-date`} value={date} onChange={changeDate} placeholder="Choose date" allowClear={!required} required={required} /></div>
    <div><label htmlFor={`${id}-time`} className="block text-xs font-semibold uppercase tracking-[0.12em] text-muted">Time</label><TimePicker id={`${id}-time`} value={time} onChange={changeTime} /></div>
  </div>;
}
