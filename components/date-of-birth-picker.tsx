"use client";

import { useEffect, useMemo, useState } from "react";
import { IconCalendar } from "@tabler/icons-react";
import { useLocale } from "next-intl";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
  /** Année mini (défaut 1900). */
  fromYear?: number;
  /** Année maxi (défaut année courante). */
  toYear?: number;
};

function parseLocalDate(value: Date | string | null | undefined): Date | undefined {
  if (value == null || value === "") return undefined;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());
  if (!match) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function DateOfBirthPicker({
  value,
  onChange,
  disabled,
  className,
  id,
  placeholder = "Choisir une date",
  fromYear = 1900,
  toYear = new Date().getFullYear(),
}: DateOfBirthPickerProps) {
  const locale = useLocale();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => setMounted(true), []);

  const validSelected = useMemo(() => parseLocalDate(value), [value]);

  const startMonth = useMemo(() => new Date(fromYear, 0, 1), [fromYear]);
  const endMonth = useMemo(() => new Date(toYear, 11, 31), [toYear]);

  const [displayMonth, setDisplayMonth] = useState<Date>(() => {
    if (validSelected) return validSelected;
    return new Date(Math.min(toYear, new Date().getFullYear() - 10), 0, 1);
  });

  useEffect(() => {
    if (validSelected) setDisplayMonth(validSelected);
  }, [validSelected]);

  const displayLabel = validSelected
    ? new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(validSelected)
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-start px-3.5 text-left text-sm font-normal",
            !validSelected && "text-muted-foreground",
            className,
          )}
          aria-label={placeholder}
        >
          <IconCalendar className="mr-2 size-4 shrink-0 opacity-70" />
          <span className="truncate">{displayLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {mounted ? (
          <Calendar
            mode="single"
            captionLayout="dropdown"
            startMonth={startMonth}
            endMonth={endMonth}
            month={displayMonth}
            onMonthChange={setDisplayMonth}
            selected={validSelected}
            onSelect={(date) => {
              onChange(date);
              if (date) {
                setDisplayMonth(date);
                setOpen(false);
              }
            }}
            disabled={(date) => date > endMonth || date < startMonth}
            className="rounded-md"
          />
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
