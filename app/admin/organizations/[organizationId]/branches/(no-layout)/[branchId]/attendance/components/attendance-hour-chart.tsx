"use client";

import { IconClock } from "@tabler/icons-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AttendanceHourStat } from "../attendance-report-types";

export function AttendanceHourChart({ data }: { data: AttendanceHourStat[] }) {
  const chartData = data.map((item) => ({
    ...item,
    label: `${item.hour}h`,
  }));

  return (
    <section className="min-w-0 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <IconClock size={16} className="text-primary" />
        Répartition des arrivées par heure
      </div>

      <div className="border-y border-border/70 py-4">
        {chartData.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Aucune donnée pour cette période.
          </p>
        ) : (
          <div className="h-52 w-full min-w-0 sm:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                barCategoryGap="12%"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  width={28}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--background))",
                    fontSize: 12,
                  }}
                  formatter={(value) => [Number(value ?? 0), "Arrivées"]}
                  labelFormatter={(label) => `Heure ${label}`}
                />
                <Bar
                  dataKey="count"
                  name="Arrivées"
                  fill="hsl(221 83% 53%)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}
