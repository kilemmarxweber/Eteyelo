import { StudentRow } from "./types";

export const studentTableColumns = (
  onScoreChange: (id: string, value: number | null) => void,
  onApplicationChange: (id: string, value: any) => void,
  onCommentChange: (id: string, value: string) => void,
) => [
  {
    key: "name",
    header: "Nom",
    cell: (s: StudentRow) => s.name,
  },
  {
    key: "firstname",
    header: "Prénom",
    cell: (s: StudentRow) => s.firstname,
  },
  {
    key: "sex",
    header: "Sexe",
    cell: (s: StudentRow) => s.sex,
  },
  {
    key: "score",
    header: "Score",
    cell: (s: StudentRow) => (
      <div className="flex items-center gap-2">
        <input
          type="number"
          className="w-16 border rounded px-1"
          defaultValue={s.score ?? ""}
          onBlur={(e) =>
            onScoreChange(
              s.studentId,
              e.target.value === "" ? null : Number(e.target.value),
            )
          }
        />
        <span>/{s.maxScore}</span>
      </div>
    ),
  },
  {
    key: "application",
    header: "App",
    cell: (s: StudentRow) => (
      <select
        value={s.application ?? ""}
        onChange={(e) => onApplicationChange(s.studentId, e.target.value)}
      >
        <option value="">—</option>
        <option value="TB">TB</option>
        <option value="B">B</option>
        <option value="AB">AB</option>
      </select>
    ),
  },
  {
    key: "comment",
    header: "Comment",
    cell: (s: StudentRow) => (
      <textarea
        className="border rounded p-1 text-xs w-full"
        defaultValue={s.comment ?? ""}
        onBlur={(e) => onCommentChange(s.studentId, e.target.value)}
      />
    ),
  },
];
