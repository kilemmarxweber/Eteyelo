"use client";

import { Result } from "@/lib/types";
import {
  ColumnDef,
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import { Eye, FileText, MessageSquare } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";

export default function ResultTable({
  data,
  totalPercentage,
  rank,
  totalStudent,
  sexeStats, // ✅ AJOUT
}: {
  data: Result[];
  totalPercentage: string;
  rank: number | null;
  totalStudent: number | null;
  sexeStats: any;
}) {
  const subjectsData = data;
  console.log(data);

  // ================= TABLE =================
  const columns: ColumnDef<Result>[] = [
    {
      accessorKey: "name",
      header: "Nom",
      cell: ({ row }) => (
        <span>
          {row.original.TypeFiche ? (
            <span className="text-blue-500 flex items-center gap-1">
              {row.original.name}
              <FileText size={16} className="text-red-500" />
            </span>
          ) : (
            <Link
              href={`/admin/results/${encodeURIComponent(
                row.original.name,
              )}?studentId=${row.original.studentId}&period=${row.original.periodName}`}
              className="text-blue-600 hover:underline font-medium"
            >
              {row.original.name}
            </Link>
          )}
        </span>
      ),
    },
    { accessorKey: "date", header: "Échéance" },
    {
      accessorKey: "status",
      header: "Statut",
      cell: ({ row }) =>
        row.original.status ? (
          <span className="px-2 py-1 text-xs bg-blue-100 rounded-full">
            {row.original.status}
          </span>
        ) : null,
    },
    {
      accessorKey: "note",
      header: "Note",
      cell: ({ row }) => {
        const note = row.original.note;
        return (
          <span
            className={
              note >= row.original.total / 2
                ? "text-green-600 font-medium"
                : "text-red-500 font-medium"
            }
          >
            {note}
          </span>
        );
      },
    },
    { accessorKey: "total", header: "Sur" },
    {
      accessorKey: "action",
      header: "",
      cell: ({ row }) =>
        row.original.TypeFiche ? (
          <span className="text-blue-500 flex items-center gap-1">
            {row.original.Comment}
          </span>
        ) : (
          <div className="flex items-center gap-3 justify-end">
            <Eye size={16} className="text-blue-500 cursor-pointer" />
            <MessageSquare
              size={16}
              className="text-green-500 cursor-pointer"
            />
          </div>
        ),
    },
  ];

  const table = useReactTable({
    data: subjectsData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // ================= TOTAL =================
  const totalScore = data.reduce((a, b) => a + b.note, 0);
  const totalMax = data.reduce((a, b) => a + b.total, 0);

  const finalPercentage =
    totalMax > 0 ? ((totalScore / totalMax) * 100).toFixed(1) : "0.0";

  // ================= GROUP BY TYPE =================
  const groupedByType = data.reduce(
    (acc, item) => {
      const key = `${item.TypeFiche}`;

      if (!acc[key]) {
        acc[key] = {
          totalNote: 0,
          totalMax: 0,
        };
      }

      acc[key].totalNote += item.note;
      acc[key].totalMax += item.total;

      return acc;
    },
    {} as Record<string, { totalNote: number; totalMax: number }>,
  );

  return (
    <table className="w-full text-sm text-left mb-4">
      {/* ================= HEADER ================= */}
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id} className="border-b">
            {headerGroup.headers.map((header) => (
              <th key={header.id} className="py-2">
                {flexRender(
                  header.column.columnDef.header,
                  header.getContext(),
                )}
              </th>
            ))}
          </tr>
        ))}
      </thead>

      {/* ================= BODY ================= */}
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id} className="border-b">
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id} className="py-2">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>

      {/* ================= FOOTER ================= */}
      <tfoot className="text-sm">
        {[
          "Place d'élève",
          "Sexe",
          "Tests Standardisés",
          "Assignments",
          "Exercices",
          "Veilles",
          "evaluations",
          "Discipline",
          "Rétrospectives",
        ].map((label, i) => {
          const group = groupedByType[label];

          const totalNote = group?.totalNote ?? 0;
          const totalMax = group?.totalMax ?? 0;

          let displayValue: string = "NA";

          if (label === "Place d'élève") {
            if (!rank || !totalStudent) {
              displayValue = "NA";
            } else {
              const studentSexe = data?.[0]?.sexe;
              const isFemale = studentSexe === "F";
              const suffix = rank === 1 ? (isFemale ? "ère" : "er") : "ème";

              displayValue = `${rank}${suffix} / ${totalStudent}`;
            }
          }

          // ================= AJOUT SEXE =================
          if (label === "Sexe") {
            return (
              <Fragment key="sex-block">
                <tr key="sex-m" className="border-b">
                  <td className="py-2 font-medium text-gray-700">Sexe (M)</td>
                  <td />
                  <td />
                  <td className="text-right font-medium text-gray-800">
                    {sexeStats.M.percent}%
                    <div className="text-[10px] text-blue-500">
                      Réussite: {sexeStats.M.successRate}%
                    </div>
                  </td>
                  <td className="text-right text-gray-500">
                    {sexeStats.M.count} élèves
                  </td>
                </tr>

                <tr key="sex-f" className="border-b">
                  <td className="py-2 font-medium text-gray-700">Sexe (F)</td>
                  <td />
                  <td />
                  <td className="text-right font-medium text-gray-800">
                    {sexeStats.F.percent}%
                    <div className="text-[10px] text-pink-500">
                      Réussite: {sexeStats.F.successRate}%
                    </div>
                  </td>
                  <td className="text-right text-gray-500">
                    {sexeStats.F.count} élèves
                  </td>
                </tr>
              </Fragment>
            );
          }

          return (
            <tr key={i} className="border-b last:border-none">
              <td className="py-2 font-medium text-gray-700">{label}</td>
              <td />
              <td />
              <td className="text-right font-medium text-gray-800">
                {displayValue}
              </td>
              <td className="text-right text-gray-500">
                {totalMax > 0
                  ? `${totalNote.toFixed(2)} / ${totalMax.toFixed(2)}`
                  : "0,00 / 0,00"}
              </td>
            </tr>
          );
        })}

        {/* ================= TOTAL ================= */}
        <tr className="border-t-2 font-semibold text-base">
          <td className="py-3">Total</td>
          <td />
          <td />
          <td className="text-right">{finalPercentage}%</td>
          <td className="text-right">
            <span
              className={
                totalScore < totalMax / 2
                  ? "text-red-500 font-semibold"
                  : "text-green-600 font-semibold"
              }
            >
              {totalScore.toFixed(1)}
            </span>{" "}
            / {totalMax.toFixed(0)}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
