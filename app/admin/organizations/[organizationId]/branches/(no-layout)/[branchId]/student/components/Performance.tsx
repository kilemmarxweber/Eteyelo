"use client";
import Image from "next/image";
import { PieChart, Pie, ResponsiveContainer } from "recharts";

const Performance = ({
  semesters,
}: {
  semesters: { label: string; average: number; max: number }[];
}) => {
  // Si aucune donnée
  if (
    semesters.length === 0 ||
    (semesters.length === 1 && semesters[0].label === "No data")
  ) {
    return (
      <div className="p-4 rounded-md h-80 flex items-center justify-center">
        <p className="text-gray-400">No performance data available</p>
      </div>
    );
  }

  const s1 = semesters[0]?.average || 0;
  const s2 = semesters[1]?.average || 0;
  const global =
    semesters.length === 1 ? s1 : Number(((s1 + s2) / 2).toFixed(1));

  const data =
    semesters.length === 1
      ? [{ name: semesters[0].label, value: s1, fill: "#C3EBFA" }]
      : [
          { name: semesters[0].label, value: s1, fill: "#C3EBFA" },
          { name: semesters[1].label, value: s2, fill: "#FAE27C" },
        ];

  const labelText =
    semesters.length === 1
      ? semesters[0].label
      : `${semesters[0].label} - ${semesters[1].label}`;

  return (
    <div className="bg-secondary p-4 rounded-md h-80 relative">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Performance</h1>
        <Image src="/uploads/moreDark.png" alt="" width={16} height={16} />
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            dataKey="value"
            startAngle={180}
            endAngle={0}
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={70}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
        <h1 className="text-3xl font-bold">{global}</h1>
        <p className="text-xs">overall / 10</p>
      </div>

      <h2 className="font-medium absolute bottom-16 left-0 right-0 m-auto text-center">
        {labelText}
      </h2>
    </div>
  );
};

export default Performance;
