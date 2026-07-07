"use server";

import { prisma } from "@/lib/prisma";

import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { revalidatePath } from "next/cache";

type FicheCentraleStudentAverage = {
  studentId: string;
  nom: string;
  prenom: string;
  sexe: string;
  totalPoints: number;
  totalMax: number;
  moyenne: number;
  pourcentage: number;
  interventions: number;
};
type FicheCentraleSummary = {
  ficheCoteId: string | null;
  ficheCoteValidated: boolean;
  ficheCoteMaxScore: number;
  className: string;
  subjectName: string;
  periodName: string;
  anneeName: string;
  nombreIntervention: number;
  students: FicheCentraleStudentAverage[];
};

export async function validateFicheCentrale(params: {
  lessonId: string;
  classId: string;
  periodId: number;
  anneeId: string;
}) {
  const { organizationId, branchId } = await requireBranchContext();
  const baseHref = `/admin/organizations/${organizationId}/branches/${branchId}`;
  const summary = await getFicheCentraleSummary(params);

  if (!summary) {
    return {
      success: false,
      message: "Aucune fiche centrale trouvée pour cette sélection.",
    };
  }

  if (!summary.ficheCoteId) {
    return {
      success: false,
      message: "La fiche de cote correspondante est introuvable.",
    };
  }

  const ficheCote = await prisma.fiche.findFirst({
    where: {
      id: summary.ficheCoteId,
      branchId,
    },
    select: {
      id: true,
      notes: true,
      periodId: true,
    },
  });

  if (!ficheCote) {
    return {
      success: false,
      message: "La fiche de cote correspondante est introuvable.",
    };
  }

  let ficheCoteNotes: any[] = [];

  try {
    ficheCoteNotes = ficheCote.notes ? JSON.parse(ficheCote.notes) : [];
  } catch {
    ficheCoteNotes = [];
  }

  const averageMap = new Map(
    summary.students.map((student) => [student.studentId, student.moyenne]),
  );

  const updatedNotes = ficheCoteNotes.map((note) => ({
    ...note,
    score: averageMap.has(note.studentId)
      ? Number(Math.round(averageMap.get(note.studentId) ?? 0))
      : Number(note.score ?? 0),
  }));

  const fiche = await prisma.fiche.update({
    where: {
      id: ficheCote.id,
    },
    data: {
      notes: JSON.stringify(updatedNotes),
      status: true,
      dateUpdated: new Date(),
    },
  });

  await prisma.fiche.updateMany({
    where: {
      branchId,
      lessonId: params.lessonId,
      classSectionId: params.classId,
      periodId: params.periodId,
      anneeId: params.anneeId,
      NOT: {
        typeFiche: "ficheCote",
      },
    },
    data: {
      status: true,
      dateUpdated: new Date(),
    },
  });

  const { gradeQueue } = await import("@/src/redis/queues/grade.queue");

  await gradeQueue.add(
    "generate-grades",
    { periodId: fiche.periodId },
    {
      jobId: `period-${fiche.periodId}`,
      removeOnComplete: true,
      removeOnFail: true,
    },
  );
  revalidatePath(`${baseHref}/ficheCentrales`);
  revalidatePath(`${baseHref}/ficheCentrales/${params.lessonId}`);
  revalidatePath(`${baseHref}/fiches/${ficheCote.id}`);
  revalidatePath(`${baseHref}/results`);

  return {
    success: true,
    message: "La fiche a été validée et les moyennes ont été reportées.",
  };
}

export async function getFicheCentraleSummary(params: {
  lessonId: string;
  classId: string;
  periodId: number;
  anneeId: string;
}): Promise<FicheCentraleSummary | null> {
  const { branchId } = await requireBranchContext();
  const fiches = await prisma.fiche.findMany({
    where: {
      branchId,
      lessonId: params.lessonId,
      classSectionId: params.classId,
      periodId: params.periodId,
      anneeId: params.anneeId,
      NOT: {
        typeFiche: "ficheCote",
      },
    },
    include: {
      lesson: {
        include: {
          cours: true,
          classe: true,
        },
      },
      period: true,
    },
    orderBy: {
      dateCreated: "asc",
    },
  });

  if (!fiches.length) {
    return null;
  }

  const ficheCote = await prisma.fiche.findFirst({
    where: {
      branchId,
      lessonId: params.lessonId,
      classSectionId: params.classId,
      periodId: params.periodId,
      anneeId: params.anneeId,
      typeFiche: "ficheCote",
    },
    select: {
      id: true,
      notes: true,
    },
  });

  let ficheCoteNotes: {
    studentId: string;
    score?: number | null;
    maxScore?: number | null;
  }[] = [];

  try {
    ficheCoteNotes = ficheCote?.notes ? JSON.parse(ficheCote.notes) : [];
  } catch {
    ficheCoteNotes = [];
  }

  const studentMap = new Map<
    string,
    {
      studentId: string;
      nom: string;
      prenom: string;
      sexe: string;
      totalPoints: number;
      totalMax: number;
      interventions: number;
    }
  >();

  for (const fiche of fiches) {
    let notes: {
      studentId: string;
      nom?: string;
      studentSurname?: string;
      studentusername?: string;
      studentSexe?: string;
      score?: number | null;
      maxScore?: number | null;
    }[] = [];

    try {
      notes = fiche.notes ? JSON.parse(fiche.notes) : [];
    } catch {
      notes = [];
    }

    for (const note of notes) {
      const current = studentMap.get(note.studentId) ?? {
        studentId: note.studentId,
        nom: note.nom ?? "",
        prenom: note.studentSurname ?? note.studentusername ?? "",
        sexe: note.studentSexe ?? "",
        totalPoints: 0,
        totalMax: 0,
        interventions: 0,
      };

      current.totalPoints += Number(note.score ?? 0);
      current.totalMax += Number(note.maxScore ?? 0);
      current.interventions += 1;

      studentMap.set(note.studentId, current);
    }
  }

  const ficheCoteMaxScore = Number(
    ficheCoteNotes.find((note) => Number(note.maxScore ?? 0) > 0)?.maxScore ??
      0,
  );

  const students = Array.from(studentMap.values())
    .map((student) => {
      const pourcentage =
        student.totalMax > 0
          ? (student.totalPoints / student.totalMax) * 100
          : 0;
      const moyenne =
        ficheCoteMaxScore > 0
          ? (pourcentage / 100) * ficheCoteMaxScore
          : student.interventions > 0
            ? student.totalPoints / student.interventions
            : 0;

      return {
        ...student,
        moyenne: Number(moyenne.toFixed(2)),
        pourcentage: Number(pourcentage.toFixed(2)),
        totalPoints: Number(student.totalPoints.toFixed(2)),
        totalMax: Number(student.totalMax.toFixed(2)),
      };
    })
    .sort((a, b) => b.moyenne - a.moyenne || a.nom.localeCompare(b.nom, "fr"));

  const ficheCoteValidated = ficheCoteNotes.some(
    (note) => Number(note.score ?? 0) > 0,
  );

  return {
    ficheCoteId: ficheCote?.id ?? null,
    ficheCoteValidated,
    ficheCoteMaxScore,
    className:
      fiches[0]?.lesson?.classe?.nameClasse ?? fiches[0]?.classeName ?? "",
    subjectName:
      fiches[0]?.lesson?.cours?.nameCours ?? fiches[0]?.coursName ?? "",
    periodName: fiches[0]?.period?.label ?? fiches[0]?.periodeName ?? "",
    anneeName: fiches[0]?.anneeName ?? "",
    nombreIntervention: fiches.length,
    students,
  };
}
