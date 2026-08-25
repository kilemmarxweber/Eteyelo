import { prisma } from "@/lib/prisma";

export type FicheRosterStudent = {
  studentId: string;
  nom?: string;
  studentSurname?: string;
  studentusername?: string;
  studentnaissance?: Date | string | null;
  studentclasse?: string;
  codestudent?: string;
  application?: string;
  comment?: string;
  studentSexe?: string;
  score?: number | null;
  maxScore?: number;
  [key: string]: unknown;
};

function parseFicheNotes(raw: string | null): Array<Record<string, unknown>> {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function ficheContextKey(fiche: { periodId: number; lessonId: string }) {
  return `${fiche.periodId}:${fiche.lessonId}`;
}

function noteSex(sex: string | null | undefined): string {
  if (sex === "Male" || sex === "M") return "M";
  if (sex === "Female" || sex === "F") return "F";
  return sex ?? "";
}

/**
 * Ajoute les élèves manquants (nom + score 0) aux fiches déjà créées
 * (évaluation, devoir, TP, ficheCote, …) tant que la fiche de cote
 * du même cours / période n'est pas validée.
 */
export async function syncClassStudentsAcrossOpenFiches({
  branchId,
  classId,
  schoolYearId,
  currentStudents,
}: {
  branchId: string;
  classId: string;
  schoolYearId: string;
  currentStudents: FicheRosterStudent[];
}) {
  const studentsById = new Map(
    currentStudents
      .filter((student) => Boolean(student.studentId))
      .map((student) => [student.studentId, student]),
  );

  if (!studentsById.size) return;

  const fiches = await prisma.fiche.findMany({
    where: {
      branchId,
      classSectionId: classId,
      anneeId: schoolYearId,
    },
    select: {
      id: true,
      notes: true,
      status: true,
      typeFiche: true,
      periodId: true,
      lessonId: true,
    },
  });

  const lockedContexts = new Set(
    fiches
      .filter((fiche) => fiche.typeFiche === "ficheCote" && fiche.status === true)
      .map(ficheContextKey),
  );

  const updates = fiches.flatMap((fiche) => {
    if (fiche.status === true) return [];
    if (lockedContexts.has(ficheContextKey(fiche))) return [];

    const existingNotes = parseFicheNotes(fiche.notes);
    const existingStudentIds = new Set(
      existingNotes
        .map((note) => String(note.studentId ?? ""))
        .filter(Boolean),
    );
    const ficheMaxScore = Number(existingNotes[0]?.maxScore ?? 0);
    const missingStudents = Array.from(studentsById.values())
      .filter((student) => !existingStudentIds.has(student.studentId))
      .map((student) => ({
        ...student,
        score: 0,
        maxScore: ficheMaxScore || Number(student.maxScore ?? 0),
      }));

    if (!missingStudents.length) return [];

    return [
      prisma.fiche.update({
        where: { id: fiche.id },
        data: {
          notes: JSON.stringify([...existingNotes, ...missingStudents]),
          dateUpdated: new Date(),
        },
      }),
    ];
  });

  if (updates.length) await prisma.$transaction(updates);
}

export async function appendStudentToOpenClassFiches({
  branchId,
  classId,
  schoolYearId,
  studentId,
}: {
  branchId: string;
  classId: string;
  schoolYearId: string;
  studentId: string;
}) {
  try {
    const [student, classe] = await Promise.all([
      prisma.student.findFirst({
        where: { id: studentId },
        select: {
          id: true,
          branchMember: {
            select: {
              member: {
                select: {
                  user: {
                    select: {
                      name: true,
                      postnom: true,
                      prenom: true,
                      dateOfBirth: true,
                      sexe: true,
                      username: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.classe.findFirst({
        where: { id: classId, branchId },
        select: { nameClasse: true },
      }),
    ]);

    const user = student?.branchMember?.member?.user;
    if (!student || !user) return;

    await syncClassStudentsAcrossOpenFiches({
      branchId,
      classId,
      schoolYearId,
      currentStudents: [
        {
          studentId: student.id,
          nom: user.name ?? "",
          studentSurname: user.postnom ?? "",
          studentusername: user.prenom ?? user.username ?? "",
          studentnaissance: user.dateOfBirth,
          studentclasse: classe?.nameClasse ?? "",
          codestudent: "",
          application: "B",
          comment: "",
          studentSexe: noteSex(user.sexe),
          score: 0,
          maxScore: 0,
        },
      ],
    });
  } catch (error) {
    console.error(
      "Impossible d'ajouter l'élève aux fiches existantes:",
      error,
    );
  }
}
