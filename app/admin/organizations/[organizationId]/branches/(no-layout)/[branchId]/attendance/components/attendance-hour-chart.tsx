"use client";

import { IconClock } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AttendanceHourStat } from "../attendance-report-types";

const HOUR_COLORS = [
  "#93c5fd",
  "#60a5fa",
  "#3b82f6",
  "#2563eb",
  "#1d4ed8",
  "#0ea5e9",
  "#06b6d4",
  "#14b8a6",
  "#10b981",
  "#34d399",
  "#f59e0b",
  "#f97316",
  "#ef4444",
];

export function AttendanceHourChart({ data }: { data: AttendanceHourStat[] }) {
  const t = useTranslations("attendance");
  const arrivalsLabel = t("reports.columns.arrival");
  const chartData = data.map((item) => ({
    ...item,
    label: `${item.hour}h`,
  }));
  const maxCount = Math.max(...chartData.map((item) => item.count), 1);

  return (
    <section className="min-w-0 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <IconClock size={16} className="text-emerald-600" />
        {t("dashboard.hourChartTitle")}
      </div>

      <div className="rounded-xl border border-emerald-500/15 bg-gradient-to-b from-emerald-500/5 to-transparent px-2 py-4 sm:px-3">
        {chartData.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t("pdf.noDataPeriod")}
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
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.35 }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--background))",
                    fontSize: 12,
                  }}
                  formatter={(value) => [Number(value ?? 0), arrivalsLabel]}
                  labelFormatter={(label) => label}
                />
                <Bar
                  dataKey="count"
                  name={arrivalsLabel}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={28}
                >
                  {chartData.map((item, index) => {
                    const intensity = item.count / maxCount;
                    const color =
                      intensity > 0.75
                        ? "#059669"
                        : intensity > 0.4
                          ? "#10b981"
                          : intensity > 0
                            ? HOUR_COLORS[index % HOUR_COLORS.length]
                            : "#cbd5e1";
                    return <Cell key={item.hour} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}
