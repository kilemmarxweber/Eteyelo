"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function DateRangePicker({ table }: any) {
  const value = (table.getColumn("date")?.getFilterValue() as any) || {
    start: null,
    end: null,
  };

  const [open, setOpen] = React.useState(false);

  const selected = {
    from: value.start ? new Date(value.start) : undefined,
    to: value.end ? new Date(value.end) : undefined,
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* TRIGGER */}
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-[260px] justify-start text-left font-normal"
        >
          <CalendarIcon className="mr-2 h-4 w-4" />

          {selected.from ? (
            selected.to ? (
              <>
                {format(selected.from, "dd/MM/yyyy")} →{" "}
                {format(selected.to, "dd/MM/yyyy")}
              </>
            ) : (
              format(selected.from, "dd/MM/yyyy")
            )
          ) : (
            "Sélectionner période"
          )}
        </Button>
      </PopoverTrigger>

      {/* CALENDAR */}
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={selected}
          onSelect={(range: any) => {
            table.getColumn("date")?.setFilterValue({
              start: range?.from
                ? range.from.toISOString().split("T")[0]
                : null,
              end: range?.to ? range.to.toISOString().split("T")[0] : null,
            });
          }}
        />

        {/* FOOTER */}
        <div className="flex justify-between p-2 border-t">
          <Button
            variant="ghost"
            onClick={() =>
              table.getColumn("date")?.setFilterValue({
                start: null,
                end: null,
              })
            }
          >
            Reset
          </Button>

          <Button onClick={() => setOpen(false)}>Done</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
