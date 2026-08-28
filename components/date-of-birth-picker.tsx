"use client";

import { useEffect, useState } from "react";
import { IconCalendar } from "@tabler/icons-react";

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

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-between text-left font-normal",
            !validSelected && "text-muted-foreground",
            className,
          )}
        >
          {validSelected ? (
            validSelected.toLocaleDateString("fr-FR", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            })
          ) : (
            <span>{placeholder}</span>
          )}
          <IconCalendar className="ml-auto h-4 w-4 opacity-50" />
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
  );
}
