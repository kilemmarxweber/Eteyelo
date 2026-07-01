import { ColumnDef } from "@tanstack/react-table";
import React from "react";

/* ===== MATIÈRES ===== */
export type LessonRow = {
  id: string;
  className: string;
  subjectName: string;
  disabled?: boolean;
};
export const ApplicationValue = ["TB", "B", "AB", "A", "AA"] as const;
export type ApplicationValue = (typeof ApplicationValue)[number];
export const APPLICATION_VALUES: ApplicationValue[] = [
  "TB",
  "B",
  "AB",
  "A",
  "AA",
];
export const lessonColumns = (
  onSelect: (lessonId: string) => void,
  selectedLessonId: string | null,
): ColumnDef<LessonRow>[] => [
  {
    id: "select",
    header: "#",
    size: 40,
    cell: ({ row }) => {
      const disabled = row.original.disabled;

      return (
        <input
          type="radio"
          checked={row.original.id === selectedLessonId}
          disabled={disabled}
          onChange={() => {
            if (!disabled) onSelect(row.original.id);
          }}
          className={disabled ? "opacity-40 cursor-not-allowed" : ""}
        />
      );
    },
  },
  {
    accessorKey: "className",
    header: "Classe",
    size: 100,
    cell: ({ row }) => <div className="truncate">{row.original.className}</div>,
  },
  {
    accessorKey: "subjectName",
    header: "Matière",
    size: 120,
    cell: ({ row }) => (
      <div className="truncate">{row.original.subjectName}</div>
    ),
  },
];
