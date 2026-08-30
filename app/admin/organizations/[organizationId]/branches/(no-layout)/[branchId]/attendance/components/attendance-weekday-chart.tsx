"use client";

import { IconChartBar } from "@tabler/icons-react";
import { useLocale, useTranslations } from "next-intl";
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
import { formatWeekdayLabel } from "../attendance-labels";
import type { AttendanceWeekdayStat } from "../attendance-report-types";
import { intlLocaleFromUserLocale, normalizeUserLocale } from "@/lib/user-locale";

const DAY_COLORS = [
  "#2563eb",
  "#0891b2",
  "#059669",
  "#d97706",
  "#db2777",
  "#7c3aed",
];

export function AttendanceWeekdayChart({
  data,
}: {
  data: AttendanceWeekdayStat[];
}) {
  const t = useTranslations("attendance");
  const locale = intlLocaleFromUserLocale(normalizeUserLocale(useLocale()));
  const presenceLabel = t("status.PRESENT");

  const chartData = data.map((item) => ({
    ...item,
    label: formatWeekdayLabel(item.dayIndex, locale, "short"),
    dayName: formatWeekdayLabel(item.dayIndex, locale, "long"),
  }));

  return (
    <section className="h-full min-w-0 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <IconChartBar size={16} className="shrink-0 text-blue-600" />
        {t("dashboard.weekdayChartTitle")}
      </div>

      <div className="rounded-xl border border-blue-500/15 bg-gradient-to-b from-blue-500/5 to-transparent px-2 py-4 sm:px-3">
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
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.35 }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--background))",
                    fontSize: 12,
                  }}
                  formatter={(value, _name, item) => {
                    const row = item?.payload as
                      | (AttendanceWeekdayStat & { dayName?: string })
                      | undefined;
                    return [
                      `${Number(value ?? 0)}% (${row?.present ?? 0}/${row?.total ?? 0})`,
                      presenceLabel,
                    ];
                  }}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as
                      | { dayName?: string }
                      | undefined;
                    return row?.dayName ?? "";
                  }}
                />
                <Bar
                  dataKey="percent"
                  name={presenceLabel}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={40}
                >
                  {chartData.map((item, index) => (
                    <Cell
                      key={item.dayIndex}
                      fill={DAY_COLORS[index % DAY_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}
