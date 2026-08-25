"use client";

import { ColumnDef } from "@tanstack/react-table";
import { StudentRow } from "./types";
import { ApplicationValue } from "./types";
import { Input } from "@/components/ui/input";
import React from "react";

const SCORE_INPUT_ATTR = "data-score-input";
const SCORE_TEXT_PATTERN = /^\d*[.,]?\d*$/;

function scoreToText(score: number | null): string {
  return score === null ? "" : String(score);
}

function parseScoreText(raw: string, maxScore: number): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (normalized === "" || normalized === "." || normalized === ",") {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;

  return Math.min(parsed, maxScore);
}

function focusNextScoreInput(current: HTMLInputElement) {
  const inputs = Array.from(
    document.querySelectorAll<HTMLInputElement>(`input[${SCORE_INPUT_ATTR}]`),
  );
  const index = inputs.indexOf(current);
  const next = inputs[index + 1];

  if (!next) return;

  next.focus();
  next.select();
}

function ScoreCell({
  row,
  onScoreChange,
}: {
  row: any;
  onScoreChange: (id: string, value: number | null) => void;
}) {
  const s = row.original;
  const focusedRef = React.useRef(false);
  const [localValue, setLocalValue] = React.useState<string>(() =>
    scoreToText(s.score),
  );

  React.useEffect(() => {
    if (focusedRef.current) return;
    setLocalValue(scoreToText(s.score));
  }, [s.score]);

  const commitText = (raw: string) => {
    if (raw !== "" && !SCORE_TEXT_PATTERN.test(raw)) return;

    const parsed = parseScoreText(raw, s.maxScore);
    const nextText =
      parsed !== null && parsed < Number(raw.replace(",", "."))
        ? String(parsed)
        : raw;

    setLocalValue(nextText);
    if (parsed !== s.score) {
      onScoreChange(s.studentId, parsed);
    }
  };

  return (
    <div className="flex items-center gap-1 whitespace-nowrap">
      <Input
        type="text"
        inputMode="decimal"
        enterKeyHint="next"
        autoComplete="off"
        data-score-input=""
        value={localValue}
        onFocus={(e) => {
          focusedRef.current = true;
          e.currentTarget.select();
        }}
        onChange={(e) => commitText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          e.stopPropagation();
          focusNextScoreInput(e.currentTarget);
        }}
        onBlur={() => {
          focusedRef.current = false;
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
