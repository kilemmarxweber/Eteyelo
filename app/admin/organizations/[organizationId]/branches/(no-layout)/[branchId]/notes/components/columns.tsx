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
import { isUniversiteBranch } from "@/lib/branch-capabilities";
import { UNIVERSITY_NOTES_LABELS } from "@/lib/university-lmd-labels";

export const lessonColumns = (
  onSelect: (lessonId: string) => void,
  selectedLessonId: string | null,
  typebranch?: unknown,
): ColumnDef<LessonRow>[] => {
  const isUniversite = isUniversiteBranch(typebranch);

  return [
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
    header: isUniversite ? UNIVERSITY_NOTES_LABELS.auditoire : "Classe",
    size: 100,
    cell: ({ row }) => <div className="truncate">{row.original.className}</div>,
  },
  {
    accessorKey: "subjectName",
    header: isUniversite ? UNIVERSITY_NOTES_LABELS.course : "Matière",
    size: 120,
    cell: ({ row }) => (
      <div className="truncate">{row.original.subjectName}</div>
    ),
  },
];
};
