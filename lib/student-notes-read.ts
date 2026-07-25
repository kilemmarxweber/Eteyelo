import { prisma } from "@/lib/prisma";

export type StudentNoteReadEntry = {
  ficheId: string;
  courseName: string;
  periodName: string;
  typeFiche: string;
  score: number;
  maxScore: number;
  comment: string | null;
  dateUpdated: string | null;
};

export type StudentNotesReadData = {
  studentId: string;
  studentName: string;
  classLabel: string | null;
  entries: StudentNoteReadEntry[];
};

type ParsedNote = {
  studentId?: string;
  score?: number | null;
  maxScore?: number | null;
  comment?: string | null;
};

/**
 * Notes en lecture pour un élève : uniquement les cours **déjà notés**
 * (entrée fiche avec `score !== null`, unit-00 §3ter / unit-05).
 */
export async function buildStudentNotesReadData(params: {
  studentId: string;
  studentName: string;
  classId: string | null;
  classLabel: string | null;
  branchId: string;
  schoolYearId?: string | null;
}): Promise<StudentNotesReadData> {
  const { studentId, studentName, classId, classLabel, branchId, schoolYearId } =
    params;

  if (!classId) {
    return {
      studentId,
      studentName,
      classLabel,
      entries: [],
    };
  }

  const currentYear =
    schoolYearId != null
      ? { id: schoolYearId }
      : await prisma.schoolYear.findFirst({
          where: {
            branchId,
            isCurrentYear: true,
            isArchived: false,
          },
          select: { id: true },
        });

  const fiches = await prisma.fiche.findMany({
    where: {
      branchId,
      classSectionId: classId,
      typeFiche: { not: "ficheCote" },
      ...(currentYear ? { anneeId: currentYear.id } : {}),
    },
    select: {
      id: true,
      coursName: true,
      periodeName: true,
      typeFiche: true,
      notes: true,
      status: true,
      dateUpdated: true,
    },
    orderBy: [{ periodeName: "asc" }, { coursName: "asc" }],
  });

  const entries: StudentNoteReadEntry[] = [];

  for (const fiche of fiches) {
    let notes: ParsedNote[] = [];
    try {
      const parsed = fiche.notes ? JSON.parse(fiche.notes) : [];
      notes = Array.isArray(parsed) ? parsed : [];
    } catch {
      notes = [];
    }

    const mine = notes.find((note) => note.studentId === studentId);
    if (!mine || mine.score === null || mine.score === undefined) {
      continue;
    }

    const score = Number(mine.score);
    if (!Number.isFinite(score)) continue;

    // Exclure les seeds score:0 non saisis (ficheCote auto) — unit-10 « déjà notés ».
    const ficheValidated = Boolean(fiche.status);
    const hasComment = Boolean(mine.comment?.trim());
    if (!ficheValidated && score === 0 && !hasComment) {
      continue;
    }

    entries.push({
      ficheId: fiche.id,
      courseName: fiche.coursName || "Cours",
      periodName: fiche.periodeName || "—",
      typeFiche: fiche.typeFiche || "—",
      score,
      maxScore: Number(mine.maxScore) || 0,
      comment: mine.comment?.trim() ? String(mine.comment) : null,
      dateUpdated: fiche.dateUpdated
        ? fiche.dateUpdated.toISOString().slice(0, 10)
        : null,
    });
  }

  return {
    studentId,
    studentName,
    classLabel,
    entries,
  };
}
