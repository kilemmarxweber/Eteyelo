"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

type AttendanceData = {
  month: string;
  present: number;
  absent: number;
  late: number;
};

const data: AttendanceData[] = [
  { month: "Jan", present: 120, absent: 15, late: 8 },
  { month: "Fev", present: 140, absent: 12, late: 5 },
  { month: "Mar", present: 130, absent: 18, late: 6 },
  { month: "Avr", present: 160, absent: 10, late: 4 },
  { month: "Mai", present: 155, absent: 13, late: 7 },
  { month: "Juin", present: 170, absent: 9, late: 3 },
];

export function AttendanceBarChart() {
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          barGap={8}
          margin={{
            top: 10,
            right: 10,
            left: 0,
            bottom: 0,
          }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#e5e7eb"
          />

          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12 }}
          />

          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />

          <Tooltip
            cursor={{
              fill: "rgba(139,92,246,0.05)",
            }}
            contentStyle={{
              borderRadius: "12px",
              border: "none",
              boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
            }}
          />

          <Legend />

          {/* Présents */}
          <Bar
            dataKey="present"
            name="Présents"
            fill="#7c3aed"
            radius={[8, 8, 0, 0]}
          />

          {/* Absents */}
          <Bar
            dataKey="absent"
            name="Absents"
            fill="#a78bfa"
            radius={[8, 8, 0, 0]}
          />

          {/* Retards */}
          <Bar
            dataKey="late"
            name="Retards"
            fill="#ddd6fe"
            radius={[8, 8, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
