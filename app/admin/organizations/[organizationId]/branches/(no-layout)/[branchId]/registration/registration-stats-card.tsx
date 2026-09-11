"use client";

import { useId, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { IconUsers } from "@tabler/icons-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { intlLocaleFromUserLocale, normalizeUserLocale } from "@/lib/user-locale";
import { cn } from "@/lib/utils";

type BranchRegistrationStats = {
  todayCount: number;
  totalCount: number;
  series: Array<{ date: string; count: number }>;
};

const EMPTY_STATS: BranchRegistrationStats = {
  todayCount: 0,
  totalCount: 0,
  series: [],
};

function formatCount(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
    value,
  );
}

export function RegistrationStatsCard({
  stats,
  loading,
}: {
  stats?: BranchRegistrationStats | null;
  loading?: boolean;
}) {
  const tReg = useTranslations("registration");
  const locale = intlLocaleFromUserLocale(normalizeUserLocale(useLocale()));
  const gradientId = useId().replace(/:/g, "");
  const data = stats ?? EMPTY_STATS;
  const todayCount = data.todayCount;
  const totalCount = data.totalCount;
  const share =
    totalCount > 0 ? Math.min(100, (todayCount / totalCount) * 100) : 0;
  const shareLabel = Number.isInteger(share)
    ? String(share)
    : share.toFixed(1);

  const chartData = useMemo(
    () =>
      data.series.map((item) => ({
        ...item,
        label: new Date(`${item.date}T12:00:00`).toLocaleDateString(locale, {
          weekday: "short",
        }),
      })),
    [data.series, locale],
  );
  const hasChartValues = chartData.some((item) => item.count > 0);
  const yMax = Math.max(1, ...chartData.map((item) => item.count));

  return (
    <Card
      padding="none"
      className="overflow-hidden border-emerald-200/70 bg-gradient-to-b from-emerald-50/80 to-card shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/30"
    >
      <CardHeader className="gap-0.5 space-y-0 border-b border-emerald-100/80 !p-4 !pb-3 dark:border-emerald-900/40">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-emerald-950 dark:text-emerald-100">
          <span className="flex size-8 items-center justify-center rounded-full bg-emerald-600 text-white">
            <IconUsers size={16} />
          </span>
          {tReg("stats.title")}
        </CardTitle>
        <CardDescription className="text-sm text-emerald-800/80 dark:text-emerald-300/80">
          {tReg("stats.subtitle")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-3">
        <div className="grid grid-cols-2 gap-2">
          <StatBlock
            label={tReg("stats.today")}
            value={loading ? "—" : formatCount(todayCount, locale)}
            tone="today"
            loading={loading}
          />
          <StatBlock
            label={tReg("stats.total")}
            value={loading ? "—" : formatCount(totalCount, locale)}
            tone="total"
            loading={loading}
          />
        </div>

        <div className="rounded-xl border border-emerald-100/80 bg-white/70 px-2 pb-1 pt-2 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <p className="px-1 text-[11px] font-medium text-emerald-800/80 dark:text-emerald-300/80">
            {tReg("stats.chart")}
          </p>
          <div className="h-[92px] w-full">
            {loading ? (
              <div className="h-full animate-pulse rounded-lg bg-emerald-100/80 dark:bg-emerald-900/40" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 8, right: 6, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#059669" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#059669" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: "currentColor" }}
                    interval={0}
                  />
                  <YAxis hide domain={[0, yMax]} />
                  <Tooltip
                    cursor={{
                      stroke: "#059669",
                      strokeWidth: 1,
                      strokeDasharray: "3 3",
                    }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.[0]) return null;
                      return (
                        <div className="rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-md">
                          <p className="font-medium">{String(label)}</p>
                          <p className="text-muted-foreground">
                            {tReg("stats.tooltip", {
                              count: Number(payload[0].value) || 0,
                            })}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#059669"
                    strokeWidth={2}
                    fill={`url(#${gradientId})`}
                    dot={
                      hasChartValues
                        ? { r: 3, strokeWidth: 0, fill: "#059669" }
                        : false
                    }
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{tReg("stats.shareLabel")}</span>
            <span className="font-medium text-emerald-800 dark:text-emerald-200">
              {loading ? "—" : tReg("stats.share", { pct: shareLabel })}
            </span>
          </div>
          <Progress value={loading ? 0 : share} className="h-1.5" />
        </div>
      </CardContent>
    </Card>
  );
}

function StatBlock({
  label,
  value,
  tone,
  loading,
}: {
  label: string;
  value: string;
  tone: "today" | "total";
  loading?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5",
        tone === "today"
          ? "border-emerald-200 bg-emerald-50/90 dark:border-emerald-800 dark:bg-emerald-950/40"
          : "border-border/70 bg-card/80",
      )}
    >
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-2xl font-bold tabular-nums leading-none tracking-tight",
          loading && "animate-pulse",
          tone === "today"
            ? "text-emerald-700 dark:text-emerald-300"
            : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}
