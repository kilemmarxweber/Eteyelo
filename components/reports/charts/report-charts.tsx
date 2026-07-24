"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ReportEmpty } from "@/components/reports/report-section";

const CHART_COLORS = [
  "hsl(221 83% 53%)",
  "hsl(189 94% 43%)",
  "hsl(142 71% 45%)",
  "hsl(25 95% 53%)",
  "hsl(340 75% 55%)",
  "hsl(262 83% 58%)",
];

export function ReportAreaChart({
  data,
  config,
  xKey = "label",
  className,
}: {
  data: Array<Record<string, string | number>>;
  config: ChartConfig;
  xKey?: string;
  className?: string;
}) {
  if (!data.length) return <ReportEmpty />;
  const keys = Object.keys(config);

  return (
    <ChartContainer config={config} className={className ?? "h-[280px] w-full"}>
      <AreaChart data={data} margin={{ left: 8, right: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} width={48} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {keys.map((key, index) => (
          <Area
            key={key}
            type="monotone"
            dataKey={key}
            stroke={`var(--color-${key})`}
            fill={`var(--color-${key})`}
            fillOpacity={0.2}
            strokeWidth={2}
            stackId={keys.length > 2 ? undefined : undefined}
            style={
              !config[key]?.color
                ? { stroke: CHART_COLORS[index % CHART_COLORS.length] }
                : undefined
            }
          />
        ))}
      </AreaChart>
    </ChartContainer>
  );
}

export function ReportBarChart({
  data,
  config,
  xKey = "name",
  stacked = false,
  className,
}: {
  data: Array<Record<string, string | number>>;
  config: ChartConfig;
  xKey?: string;
  stacked?: boolean;
  className?: string;
}) {
  if (!data.length) return <ReportEmpty />;
  const keys = Object.keys(config);

  return (
    <ChartContainer config={config} className={className ?? "h-[280px] w-full"}>
      <BarChart data={data} margin={{ left: 8, right: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} width={48} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {keys.map((key) => (
          <Bar
            key={key}
            dataKey={key}
            fill={`var(--color-${key})`}
            radius={[6, 6, 0, 0]}
            stackId={stacked ? "a" : undefined}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}

export function ReportDonutChart({
  data,
  config,
  nameKey = "name",
  valueKey = "value",
  className,
}: {
  data: Array<Record<string, string | number>>;
  config: ChartConfig;
  nameKey?: string;
  valueKey?: string;
  className?: string;
}) {
  const filtered = data.filter((d) => Number(d[valueKey]) > 0);
  if (!filtered.length) return <ReportEmpty />;

  return (
    <ChartContainer config={config} className={className ?? "h-[280px] w-full"}>
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey={nameKey} />} />
        <Pie
          data={filtered}
          dataKey={valueKey}
          nameKey={nameKey}
          innerRadius={60}
          outerRadius={95}
          paddingAngle={3}
        >
          {filtered.map((entry, index) => {
            const key = String(entry[nameKey]);
            const color =
              config[key]?.color ?? CHART_COLORS[index % CHART_COLORS.length];
            return <Cell key={key} fill={color} />;
          })}
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey={nameKey} />} />
      </PieChart>
    </ChartContainer>
  );
}

export function ReportRadialChart({
  value,
  label,
  className,
}: {
  value: number;
  label: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const data = [{ name: label, value: clamped, fill: "var(--color-rate)" }];
  const config = {
    rate: { label, color: "hsl(221 83% 53%)" },
  } satisfies ChartConfig;

  return (
    <div className="relative">
      <ChartContainer config={config} className={className ?? "h-[220px] w-full"}>
        <RadialBarChart
          data={data}
          startAngle={90}
          endAngle={-270}
          innerRadius="60%"
          outerRadius="100%"
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar dataKey="value" background cornerRadius={8} />
        </RadialBarChart>
      </ChartContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-2xl font-bold text-foreground">{clamped}%</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function ReportFunnelChart({
  data,
  className,
}: {
  data: Array<{ name: string; value: number }>;
  className?: string;
}) {
  if (!data.length || data.every((d) => d.value === 0)) {
    return <ReportEmpty />;
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const chartData = data.map((d, i) => ({
    ...d,
    fill: CHART_COLORS[i % CHART_COLORS.length],
    width: Math.max(18, Math.round((d.value / max) * 100)),
  }));

  const config = Object.fromEntries(
    chartData.map((d) => [d.name, { label: d.name, color: d.fill }]),
  ) satisfies ChartConfig;

  return (
    <ChartContainer config={config} className={className ?? "h-[280px] w-full"}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 16, right: 16 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tickLine={false}
          axisLine={false}
        />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="value" radius={[0, 8, 8, 0]}>
          {chartData.map((entry) => (
            <Cell key={entry.name} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
