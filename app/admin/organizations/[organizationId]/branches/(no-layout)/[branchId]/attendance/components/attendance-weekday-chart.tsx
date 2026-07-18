"use client";

import { IconChartBar } from "@tabler/icons-react";
import type { AttendanceWeekdayStat } from "../attendance-report-types";

export function AttendanceWeekdayChart({
  data,
}: {
  data: AttendanceWeekdayStat[];
}) {
  return (
    <section className="h-full min-w-0 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <IconChartBar size={16} className="shrink-0 text-primary" />
        Presences par jour de semaine
      </div>

      <div className="border-y border-border/70 py-4">
        <div className="grid w-full grid-cols-6 gap-1 sm:gap-3">
          {data.map((item) => (
            <div
              key={item.day}
              className="flex min-w-0 flex-col items-center justify-end text-center"
            >
              <p className="w-full truncate text-[10px] text-muted-foreground sm:text-xs">
                {item.day}
              </p>
              <p className="mt-1 text-base font-bold leading-none text-foreground sm:mt-2 sm:text-xl">
                {item.percent}%
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground sm:text-[11px]">
                {item.present}/{item.total}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
