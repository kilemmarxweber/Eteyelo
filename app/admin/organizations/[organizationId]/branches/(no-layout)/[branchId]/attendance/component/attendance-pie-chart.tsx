"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  {
    name: "Présents",
    value: 73,
  },
  {
    name: "Absents",
    value: 20,
  },
  {
    name: "Retards",
    value: 7,
  },
];

const COLORS = ["#8b5cf6", "#c4b5fd", "#ede9fe"];

export function AttendancePieChart() {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={data}
          innerRadius={70}
          outerRadius={110}
          paddingAngle={4}
          dataKey="value"
        >
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index]} />
          ))}
        </Pie>

        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}
