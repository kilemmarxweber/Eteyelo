"use client";

import { IconClock } from "@tabler/icons-react";
import type { AttendanceHourStat } from "../attendance-report-types";

export function AttendanceHourChart({ data }: { data: AttendanceHourStat[] }) {
  const maxCount = Math.max(...data.map((item) => item.count), 1);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <IconClock size={16} className="text-primary" />
        Repartition des arrivees par heure
      </div>

      <div className="border-y border-border/70 py-4">
        <div className="flex h-44 items-end justify-between gap-1 sm:gap-2">
          {data.map((item) => {
            const height = item.count > 0 ? Math.max((item.count / maxCount) * 100, 12) : 0;

            return (
              <div
                key={item.hour}
                className="flex min-w-0 flex-1 flex-col items-center justify-end"
              >
                {item.count > 0 ? (
                  <span className="mb-1 text-[11px] font-semibold text-blue-600">
                    {item.count}
                  </span>
                ) : (
                  <span className="mb-1 text-[11px] text-transparent">0</span>
                )}
                <div
                  className="w-full max-w-[28px] rounded-t bg-blue-600 transition-all"
                  style={{ height: `${height}%`, minHeight: item.count > 0 ? "8px" : "0" }}
                />
                <span className="mt-2 text-[10px] text-muted-foreground sm:text-[11px]">
                  {item.hour}h
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
