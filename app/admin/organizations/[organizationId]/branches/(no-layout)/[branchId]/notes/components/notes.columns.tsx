"use client";

import { ColumnDef } from "@tanstack/react-table";
import { StudentRow } from "./types";
import { ApplicationValue } from "./types";
import { Input } from "@/components/ui/input";
import React from "react";
function ScoreCell({
  row,
  onScoreChange,
}: {
  row: any;
  onScoreChange: (id: string, value: number | null) => void;
}) {
  const s = row.original;

  const [localValue, setLocalValue] = React.useState<string>(
    s.score === null ? "" : String(s.score),
  );

  React.useEffect(() => {
    setLocalValue(s.score === null ? "" : String(s.score));
  }, [s.score]);

  return (
    <div className="flex items-center gap-1 whitespace-nowrap">
      <Input
        type="number"
        min={0}
        max={s.maxScore}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => {
          const parsed =
            localValue === "" ? null : Math.min(Number(localValue), s.maxScore);

          onScoreChange(s.studentId, isNaN(parsed as any) ? null : parsed);
        }}
        className="w-16 h-8 px-2"
      />
      <span className="text-xs">/{s.maxScore}</span>
    </div>
  );
}

export const notesColumns = (
  onScoreChange: (id: string, value: number | null) => void,
  onApplicationChange: (id: string, value: ApplicationValue | "") => void,
  onCommentChange: (id: string, value: string) => void,
): ColumnDef<StudentRow>[] => [
  {
    accessorKey: "name",
    header: "Nom",
    cell: ({ row }) => row.original.name,
  },
  {
    accessorKey: "firstname",
    header: "Prénom",
    cell: ({ row }) => row.original.firstname,
  },
  {
    accessorKey: "sex",
    header: "Sexe",
    cell: ({ row }) => row.original.sex,
  },

  /* ===== SCORE FIX ===== */
  {
    accessorKey: "score",
    header: "Score",
    size: 85,
    cell: ({ row }) => <ScoreCell row={row} onScoreChange={onScoreChange} />,
  },

  {
    accessorKey: "application",
    header: "App",
    cell: ({ row }) => {
      const s = row.original;

      return (
        <select
          className="w-14 h-8 rounded-md border border-input bg-background px-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          value={s.application ?? ""}
          onChange={(e) =>
            onApplicationChange(s.studentId, e.target.value as any)
          }
        >
          <option value="">—</option>
          <option value="TB">TB</option>
          <option value="B">B</option>
          <option value="AB">AB</option>
          <option value="A">A</option>
          <option value="AA">AA</option>
        </select>
      );
    },
  },

  {
    accessorKey: "comment",
    header: "Commentaire",
    cell: ({ row }) => {
      const s = row.original;

      return (
        <textarea
          className="w-full h-8 min-h-8 rounded-md border border-input bg-background px-2 py-0.5 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          value={s.comment ?? ""}
          onChange={(e) => onCommentChange(s.studentId, e.target.value)}
        />
      );
    },
  },
];
