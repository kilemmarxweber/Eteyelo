"use client";

import { IconChartBar } from "@tabler/icons-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AttendanceWeekdayStat } from "../attendance-report-types";

const SHORT_DAY: Record<string, string> = {
  Lundi: "Lun",
  Mardi: "Mar",
  Mercredi: "Mer",
  Jeudi: "Jeu",
  Vendredi: "Ven",
  Samedi: "Sam",
};

export function AttendanceWeekdayChart({
  data,
}: {
  data: AttendanceWeekdayStat[];
}) {
  const chartData = data.map((item) => ({
    ...item,
    label: SHORT_DAY[item.day] ?? item.day.slice(0, 3),
  }));

  return (
    <section className="h-full min-w-0 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <IconChartBar size={16} className="shrink-0 text-primary" />
        Présences par jour de semaine
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
                barCategoryGap="18%"
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
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  width={36}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--background))",
                    fontSize: 12,
                  }}
                  formatter={(value, _name, item) => {
                    const row = item?.payload as AttendanceWeekdayStat | undefined;
                    return [
                      `${Number(value ?? 0)}% (${row?.present ?? 0}/${row?.total ?? 0})`,
                      "Présence",
                    ];
                  }}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as
                      | AttendanceWeekdayStat
                      | undefined;
                    return row?.day ?? "";
                  }}
                />
                <Bar
                  dataKey="percent"
                  name="Présence"
                  fill="hsl(221 83% 53%)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}
