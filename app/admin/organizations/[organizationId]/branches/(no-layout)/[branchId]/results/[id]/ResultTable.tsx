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
import { useParams } from "next/navigation";
import { getResultSummaryTypeLabels } from "@/lib/fiche-type-options";

type InterventionResult = Result & {
  ficheId?: string;
};

export default function ResultTable({
  data,
  totalPercentage,
  typebranch,
}: {
  data: InterventionResult[];
  totalPercentage: string;
  typebranch?: unknown;
}) {
  const params = useParams<{ organizationId: string; branchId: string }>();
  const organizationId = params.organizationId;
  const branchId = params.branchId;
  const fichesBaseHref =
    organizationId && branchId
      ? `/admin/organizations/${organizationId}/branches/${branchId}/fiches`
      : null;

  const subjectsData = data;

  const columns = [
    {
      accessorKey: "name",
      header: "Nom",
      cell: ({ row }) => {
        const ficheHref =
          fichesBaseHref && row.original.ficheId
            ? `${fichesBaseHref}/${row.original.ficheId}`
            : null;

        return ficheHref ? (
          <Link
            href={ficheHref}
            className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
          >
            {row.original.name}
            <FileText size={16} className="text-red-500" />
          </Link>
        ) : (
          <span className="flex items-center gap-1 text-blue-500">
            {row.original.name}
            <FileText size={16} className="text-red-500" />
          </span>
        );
      },
    },
    { accessorKey: "date", header: "Échéance" },
    {
      accessorKey: "status",
      header: "Statut",
      cell: ({ row }) =>
        row.original.status ? (
          <span className="rounded-full bg-blue-100 px-2 py-1 text-xs">
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
                ? "font-medium text-green-600"
                : "font-medium text-red-500"
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
      cell: ({ row }) => {
        const ficheHref =
          fichesBaseHref && row.original.ficheId
            ? `${fichesBaseHref}/${row.original.ficheId}`
            : null;

        if (row.original.Comment) {
          return (
            <span className="flex items-center gap-1 text-blue-500">
              {row.original.Comment}
            </span>
          );
        }

        if (!ficheHref) return null;

        return (
          <div className="flex items-center justify-end gap-3">
            <Link
              href={ficheHref}
              title="Voir le détail de l'intervention"
              className="text-blue-500 hover:text-blue-600"
            >
              <Eye size={16} />
            </Link>
            <MessageSquare size={16} className="cursor-pointer text-green-500" />
          </div>
        );
      },
    },
  ] as ColumnDef<(typeof subjectsData)[0]>[];

  const table = useReactTable({
    data: subjectsData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const totalScore = data.reduce((a, b) => a + b.note, 0);
  const maxscore = data[0]?.Maxscore ?? 0;
  const totalMax = data.reduce((a, b) => a + b.total, 0);
  totalPercentage =
    totalMax > 0
      ? data[0]?.TypeFiche
        ? ((((totalScore / totalMax) * maxscore) / maxscore) * 100).toFixed(1)
        : ((totalScore / totalMax) * 100).toFixed(1)
      : "0.0";

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
    <table className="mb-4 w-full text-left text-sm">
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
      <tfoot className="text-sm">
        {getResultSummaryTypeLabels(typebranch).map((label, i) => {
          const group = groupedByType[label];

          const totalNote = group?.totalNote ?? 0;
          const groupMax = group?.totalMax ?? 0;

          const percentage =
            groupMax > 0 ? ((totalNote / groupMax) * 100).toFixed(2) : "0.00";

          return (
            <tr key={i} className="border-b last:border-none">
              <td className="py-2 font-medium text-gray-700">{label}</td>
              <td />
              <td />
              <td className="text-right font-medium text-gray-800">
                {groupMax > 0 ? `${percentage}%` : "NA"}
              </td>
              <td className="text-right text-gray-500">
                {groupMax > 0
                  ? `${totalNote.toFixed(2)} / ${groupMax.toFixed(2)}`
                  : "0,00 / 0,00"}
              </td>
            </tr>
          );
        })}

        <tr className="border-t-2 text-base font-semibold">
          <td className="py-3">Total</td>
          <td />
          <td />
          <td
            className={`text-right ${
              Number(totalPercentage) < 50 ? "text-red-500" : "text-gray-800"
            }`}
          >
            {totalPercentage}%
          </td>
          <td className="text-right">
            {data[0]?.TypeFiche ? (
              <>
                <span
                  className={
                    (totalScore / totalMax) * maxscore < maxscore / 2
                      ? "font-semibold text-red-500"
                      : "font-semibold text-green-600"
                  }
                >
                  {((totalScore / totalMax) * maxscore).toFixed(2)}
                </span>{" "}
                / {maxscore}
              </>
            ) : (
              <>
                <span
                  className={
                    totalScore < totalMax / 2
                      ? "font-semibold text-red-500"
                      : "font-semibold text-green-600"
                  }
                >
                  {totalScore.toFixed(1)}
                </span>{" "}
                / {totalMax.toFixed(0)}
              </>
            )}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
