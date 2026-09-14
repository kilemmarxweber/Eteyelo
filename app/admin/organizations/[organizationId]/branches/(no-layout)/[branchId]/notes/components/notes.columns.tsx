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
  const localValueRef = React.useRef(scoreToText(s.score));
  const [localValue, setLocalValue] = React.useState<string>(() =>
    scoreToText(s.score),
  );

  React.useEffect(() => {
    if (focusedRef.current) return;
    const next = scoreToText(s.score);
    localValueRef.current = next;
    setLocalValue(next);
  }, [s.score]);

  const commitParsed = (raw: string) => {
    const parsed = parseScoreText(raw, s.maxScore);
    if (parsed !== s.score) {
      onScoreChange(s.studentId, parsed);
    }
    return parsed;
  };

  const applyText = (raw: string) => {
    if (raw !== "" && !SCORE_TEXT_PATTERN.test(raw)) return;

    const parsed = parseScoreText(raw, s.maxScore);
    const nextText =
      parsed !== null && parsed < Number(raw.replace(",", "."))
        ? String(parsed)
        : raw;

    localValueRef.current = nextText;
    setLocalValue(nextText);
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
        onChange={(e) => applyText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          e.stopPropagation();
          commitParsed(localValueRef.current);
          focusNextScoreInput(e.currentTarget);
        }}
        onBlur={() => {
          focusedRef.current = false;
          commitParsed(localValueRef.current);
        }}
        className="w-16 h-8 px-2"
      />
      <span className="text-xs">/{s.maxScore}</span>
    </div>
  );
}

function CommentCell({
  row,
  onCommentChange,
}: {
  row: any;
  onCommentChange: (id: string, value: string) => void;
}) {
  const s = row.original;
  const focusedRef = React.useRef(false);
  const localValueRef = React.useRef(s.comment ?? "");
  const [localValue, setLocalValue] = React.useState(s.comment ?? "");

  React.useEffect(() => {
    if (focusedRef.current) return;
    const next = s.comment ?? "";
    localValueRef.current = next;
    setLocalValue(next);
  }, [s.comment]);

  return (
    <textarea
      className="w-full h-8 min-h-8 rounded-md border border-input bg-background px-2 py-0.5 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-ring"
      value={localValue}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onChange={(e) => {
        const next = e.target.value;
        localValueRef.current = next;
        setLocalValue(next);
      }}
      onBlur={() => {
        focusedRef.current = false;
        if (localValueRef.current !== (s.comment ?? "")) {
          onCommentChange(s.studentId, localValueRef.current);
        }
      }}
    />
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
    meta: { label: "Nom" },
    cell: ({ row }) => row.original.name,
  },
  {
    accessorKey: "firstname",
    header: "Prénom",
    meta: { label: "Prénom" },
    cell: ({ row }) => row.original.firstname,
  },
  {
    accessorKey: "sex",
    header: "Sexe",
    meta: { label: "Sexe" },
    cell: ({ row }) => row.original.sex,
  },

  /* ===== SCORE FIX ===== */
  {
    accessorKey: "score",
    header: "Score",
    meta: { label: "Score" },
    size: 85,
    cell: ({ row }) => <ScoreCell row={row} onScoreChange={onScoreChange} />,
  },

  {
    accessorKey: "application",
    header: "App",
    meta: { label: "Application" },
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
    meta: { label: "Commentaire" },
    cell: ({ row }) => (
      <CommentCell row={row} onCommentChange={onCommentChange} />
    ),
  },
];
