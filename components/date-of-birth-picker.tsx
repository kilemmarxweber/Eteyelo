"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { IconCalendar } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type DateOfBirthPickerProps = {
  value?: Date | string | null;
  onChange: (date: Date | undefined) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  placeholder?: string;
};

export function DateOfBirthPicker({
  value,
  onChange,
  disabled,
  className,
  id,
  placeholder = "Choisir une date",
}: DateOfBirthPickerProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const selected =
    value instanceof Date
      ? value
      : value
        ? new Date(value)
        : undefined;
  const validSelected =
    selected && !Number.isNaN(selected.getTime()) ? selected : undefined;
  const inputValue = validSelected
    ? [
        validSelected.getFullYear(),
        String(validSelected.getMonth() + 1).padStart(2, "0"),
        String(validSelected.getDate()).padStart(2, "0"),
      ].join("-")
    : "";

  function handleManualChange(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value;
    if (!raw) {
      onChange(undefined);
      return;
    }
    const [year, month, day] = raw.split("-").map(Number);
    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      !Number.isInteger(day)
    ) {
      return;
    }
    onChange(new Date(year, month - 1, day));
  }

  return (
    <div className="flex min-w-0 gap-2">
      <Input
        id={id}
        type="date"
        value={inputValue}
        onChange={handleManualChange}
        disabled={disabled}
        className={cn("min-w-0 flex-1", className)}
        aria-label={placeholder}
      />
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="size-10 shrink-0 px-0"
            aria-label="Ouvrir le calendrier"
            title={placeholder}
          >
            <IconCalendar className="h-4 w-4 opacity-70" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          {mounted ? (
            <Calendar
              mode="single"
              captionLayout="dropdown"
              fromYear={1900}
              toYear={new Date().getFullYear()}
              selected={validSelected}
              onSelect={onChange}
            />
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}
