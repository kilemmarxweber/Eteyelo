"use server";

import { v4 as uuidv4 } from "uuid";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/prisma/generated/prisma/client";
import { gradeQueue } from "@/src/redis/queues/grade.queue";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
// src/lib/actions.ts
import fs from "fs/promises";
import path from "path";

import { headers } from "next/headers";

import { FicheTypes } from "./types";
import { auth } from "@/lib/auth";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { listBranchPeriodOptions } from "@/lib/academic-periods";
import { canManageOrganization } from "@/lib/auth/session-roles";
import { getSchoolYear as getCurrentSchoolYear } from "@/lib/school-year";
import {
  getCoursePonderationMap,
  resolveCoursePonderation,
} from "@/lib/course-ponderation";

export async function logout() {
  await auth.api.signOut({
    headers: await headers(),
  });

  redirect("/");
}

export async function authenticate(_prevState: any, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    await auth.api.signInEmail({
      body: {
        email,
        password,
      },
      headers: await headers(),
    });
  } catch {
    return "Email ou mot de passe invalide.";
  }

  return null;
}
export async function getSchoolYear() {
  return getCurrentSchoolYear();
}

type CurrentState = { success: boolean; error: boolean };

export async function saveImage(base64: string): Promise<string> {
  try {
    if (!base64.startsWith("data:")) return base64;

    const match = base64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) throw new Error("Invalid base64 image format");

    const mimeType = match[1];
    const ext = mimeType.split("/")[1];
    const buffer = Buffer.from(match[2], "base64");

    const fileName = `${Date.now()}.${ext}`;
    const filePath = path.join(process.cwd(), "public", "uploads", fileName);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);

    return `${fileName}`;
  } catch (error) {
    console.error("Error saving image:", error);
    return "";
  }
}

export async function archiveTeacher(
  currentState: CurrentState,
  formData: FormData,
): Promise<CurrentState> {
  try {
    const teacherId = formData.get("id") as string;
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      include: {
        branchMember: { include: { member: { include: { user: true } } } },
      },
    });
    if (!teacher) return { success: false, error: true };

    const userId = teacher.branchMember?.member?.user?.id;
    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: { statusUser: false },
      });
    }

    return { success: true, error: false };
  } catch (error) {
    console.error("Archive teacher error:", error);
    return { success: false, error: true };
  }
}

/** @deprecated Utiliser archiveTeacher */
export async function deleteTeacher(
  currentState: CurrentState,
  formData: FormData,
): Promise<CurrentState> {
  return archiveTeacher(currentState, formData);
}

export async function archiveStudent(
  currentState: CurrentState,
  formData: FormData,
): Promise<CurrentState> {
  try {
    const studentId = formData.get("id") as string;

    await prisma.student.update({
      where: { id: studentId },
      data: { statusStudent: false },
    });

    return { success: true, error: false };
  } catch (error) {
    console.error("Archive student error:", error);
    return { success: false, error: true };
  }
}

/** @deprecated Utiliser archiveStudent */
export async function deleteStudent(
  currentState: CurrentState,
  formData: FormData,
): Promise<CurrentState> {
  return archiveStudent(currentState, formData);
}

type AffectationInput = {
  studentIds: string[]; // liste des élèves à affecter
  classId: number; // classe cible
  schoolYearId: number; // année scolaire sélectionnée
};

type Note = {
  studentId: string;
  nom: string;
  studentSurname: string;
  studentusername: string;
  studentSexe: string;
  score: number | null;
  maxScore: number;
  appreciation?: string;
  conduite?: string;
  comment?: string;
};
export type TypeFiches = {
  TOTAUX: any[];
  POURCENTAGES: any[];
  "PLACE/NOMBRE D'ELEVES": any[];
  APPLICATIONS: any[];
  CONDUITE: any[];
  "SIGNATURE PARENTS": any[];
};
const typeFichesDefault = {
  TOTAUX: [],
  POURCENTAGES: [],
  "PLACE/NOMBRE D'ELEVES": [],
  APPLICATIONS: [],
  CONDUITE: [],
  "SIGNATURE PARENTS": [],
};
type FicheOption = "global" | "cumule" | "individuel";
interface CreateFicheParams {
  teacherId: string; // ✅ AJOUTÉ
  classId: string;
  periodId: number;
  schoolYearId: string;
  lessonId: string;
  subjectName: string;
  className: string;
  periodName: string;
  anneeId: string;
  anneeName: string;
  typeFiche: FicheTypes;
  ficheOption: FicheOption;
  notes: Note[];
  autres: TypeFiches[]; // ✅ AJOUT
  status?: boolean;
}

interface CreateFicheResult {
  success: boolean;
  error?: boolean;
  message?: string; // ✅ AJOUT
}

export async function getStudentsByClass(
  classId: string,
  schoolYearId?: string,
) {
  const { branchId } = await requireBranchContext();
  const classe = await prisma.classe.findFirst({
    where: {
      id: classId,
      branchId,
    },
  });

  if (!classe) {
    return [];
  }

  const currentYear = schoolYearId
    ? null
    : await prisma.schoolYear.findFirst({
        where: {
          isCurrentYear: true,
          branchId,
        },
      });

  if (!schoolYearId && !currentYear) {
    return [];
  }

  const students = await prisma.classEnrollment.findMany({
    where: {
      branchId,
      classeId: classe.id,
      schoolYearId: schoolYearId ?? currentYear?.id,
      schoolYear: {
        branchId,
      },
    },
    include: {
      classe: true,
      schoolYear: true,
      student: {
        include: {
          branchMember: {
            include: {
              member: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return students
    .filter((enrollment) => enrollment.student?.branchMember?.member?.user)
    .map((enrollment) => {
      const student = enrollment.student!;
      const user = student.branchMember.member.user;
      const studentSexe = user.sexe ?? "";
      const birthday = user.dateOfBirth ?? null;
      const firstname = user.prenom ?? user.name ?? "";
      const lastname = user.postnom ?? "";
      const username = user.username ?? user.email?.split("@")[0] ?? firstname;

      return {
        studentId: student.id,
        firstname,
        lastname,
        surname: username,
        name: user.name ?? "",
        sex: studentSexe,
        birthday,
        classname: enrollment.classe?.nameClasse ?? classe.nameClasse,
        schoolYear: enrollment.schoolYearId,
        gradeId: "0",
        studentSurname: lastname,
        studentusername: firstname || username,
        studentnaissance: birthday?.toISOString() ?? "",
        studentclasse: enrollment.classe?.nameClasse ?? classe.nameClasse,
        studentSexe,
        category: student.category,
      };
    });
}
// récupère toutes les périodes / sessions selon le type de branche
export async function getPeriods() {
  const { branchId, typebranch } = await requireBranchContext();
  const periods = await listBranchPeriodOptions({ branchId, typebranch });

  return periods.map((period) => ({
    id: period.id,
    label: period.label,
    rawLabel: period.rawLabel,
    kind: period.kind,
  }));
}

export type FicheResultBase = {
  id: string;

  teacher: any;
  teacherName: string;

  lessonId: string;
  subjectName: string;

  classId: string;
  className: string;

  periodId: number;
  periodName: string;

  anneeId: string;
  anneeName: string;

  typeFiche: string | null;
  status: boolean;
  dateCreated: string;

  notes: any[];
  autres: any;
};
export type FicheResults = FicheResultBase & {
  nombreIntervention: number;
  moyenneSur?: number;
  ficheCoteId?: string | null;
};

const ficheTeacherInclude = {
  branchMember: {
    include: {
      member: {
        include: {
          user: true,
        },
      },
    },
  },
} satisfies Prisma.TeacherInclude;

type FicheTeacherWithUser = Prisma.TeacherGetPayload<{
  include: typeof ficheTeacherInclude;
}>;

function getFicheTeacherUser(teacher?: FicheTeacherWithUser | null) {
  return teacher?.branchMember?.member?.user ?? null;
}

export async function getFichesGroupedByCoursAnnee(): Promise<FicheResults[]> {
  try {
    const { branchId } = await requireBranchContext();
    const currentYear = await prisma.schoolYear.findFirst({
      where: { isCurrentYear: true, branchId },
    });

    if (!currentYear) {
      throw new Error("Année scolaire introuvable");
    }

    // 1️⃣ FETCH DATA
    const fiches = await prisma.fiche.findMany({
      where: {
        branchId,
        anneeId: currentYear.id,
        status: false,
        NOT: {
          typeFiche: "ficheCote",
        },
      },
      include: {
        teacher: { include: ficheTeacherInclude },
        period: true,
        lesson: {
          include: {
            cours: true,
            classe: true,
          },
        },
      },
      orderBy: {
        dateCreated: "desc",
      },
    });

    // 2️⃣ MAP TO BASE TYPE
    const mapped: FicheResultBase[] = fiches.map((f) => {
      const teacherUser = getFicheTeacherUser(f.teacher);

      return {
        id: f.id,

        teacher: f.teacher,
        teacherName: teacherUser?.name ?? "N/A",

        lessonId: f.lessonId,
        subjectName: f.lesson?.cours?.nameCours ?? f.coursName ?? "N/A",

        classId: f.classSectionId,
        className: f.lesson?.classe?.nameClasse ?? f.classeName ?? "N/A",

        periodId: f.periodId,
        periodName: f.period?.label ?? "N/A",

        anneeId: f.anneeId,
        anneeName: f.anneeName,

        typeFiche: f.typeFiche,
        status: f.status,
        dateCreated: f.dateCreated.toISOString(),

        notes: f.notes ? JSON.parse(f.notes) : [],
        autres: f.autres ? JSON.parse(f.autres) : {},
      };
    });

    const ficheCoteMap = new Map<
      string,
      {
        id: string;
        notes: {
          studentId: string;
          score?: number | null;
          maxScore?: number | null;
        }[];
      }
    >();

    const ficheCotes = await prisma.fiche.findMany({
      where: {
        branchId,
        anneeId: currentYear.id,
        typeFiche: "ficheCote",
      },
      select: {
        id: true,
        lessonId: true,
        classSectionId: true,
        periodId: true,
        anneeId: true,
        notes: true,
      },
    });

    for (const fiche of ficheCotes) {
      let parsedNotes: {
        studentId: string;
        score?: number | null;
        maxScore?: number | null;
      }[] = [];

      try {
        parsedNotes = fiche.notes ? JSON.parse(fiche.notes) : [];
      } catch {
        parsedNotes = [];
      }

      ficheCoteMap.set(
        `${fiche.lessonId}_${fiche.classSectionId}_${fiche.periodId}_${fiche.anneeId}`,
        {
          id: fiche.id,
          notes: parsedNotes,
        },
      );
    }

    // 3️⃣ GROUP BY lesson + class + period + year
    const groupedMap = new Map<string, FicheResults>();

    for (const fiche of mapped) {
      const key = `${fiche.lessonId}_${fiche.classId}_${fiche.periodId}_${fiche.anneeId}`;
      const ficheCote =
        ficheCoteMap.get(
          `${fiche.lessonId}_${fiche.classId}_${fiche.periodId}_${fiche.anneeId}`,
        ) ?? null;

      const noteStats = ficheCote?.notes ?? [];
      const validScores = noteStats
        .map((note) =>
          typeof note.score === "number" && typeof note.maxScore === "number"
            ? (note.score / Math.max(note.maxScore, 1)) * note.maxScore
            : null,
        )
        .filter((value): value is number => value !== null);

      const moyenneSur =
        validScores.length > 0
          ? Number(
              (
                validScores.reduce((sum, value) => sum + value, 0) /
                validScores.length
              ).toFixed(2),
            )
          : undefined;

      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          ...fiche,
          nombreIntervention: 1,
          moyenneSur,
          ficheCoteId: ficheCote?.id ?? null,
        });
      } else {
        const existing = groupedMap.get(key)!;
        existing.nombreIntervention += 1;
      }
    }

    // 4️⃣ RETURN ARRAY
    return Array.from(groupedMap.values());
  } catch (err) {
    console.error("getFichesGroupedByCoursAnnee error:", err);
    return [];
  }
}
function teachingWithFicheArgs(branchId: string, schoolYearId: string) {
  return {
    include: {
      cours: true,
      classe: true,
      fiche: {
        where: {
          branchId,
          anneeId: schoolYearId,
          typeFiche: "ficheCote",
        },
        include: {
          teacher: {
            include: ficheTeacherInclude,
          },
          period: true,
        },
        orderBy: [{ periodId: "asc" }, { dateCreated: "desc" }],
      },
    },
  } satisfies Prisma.TeachingFindManyArgs;
}

type FicheResult = {
  id: string;
  teacherName: string;
  subjectName: string;
  coursId?: string;
  primaryDomain?: string | null;
  primarySection?: string | null;
  domainOrder?: number | null;
  periodName: string;
  className: string;
  dateCreated: string;
  anneeName: string;
  typeFiche: string | null; // ✅ clé
  notes: any[];
  autres: any;
  coursePonderation: number;
};

export async function getLessonsWithFichesByClass(
  classId: string,
): Promise<FicheResult[]> {
  const { branchId } = await requireBranchContext();
  const currentYear = await prisma.schoolYear.findFirst({
    where: {
      isCurrentYear: true,
      branchId,
    },
  });

  if (!currentYear) {
    return [];
  }

  const lessons = await prisma.teaching.findMany({
    ...teachingWithFicheArgs(branchId, currentYear.id),
    where: {
      OR: [{ statusTeaching: true }, { statusTeaching: null }],
      AND: [
        {
          OR: [
            { branchId },
            {
              branchId: null,
              classe: {
                branchId,
              },
            },
          ],
        },
      ],
      classeId: classId,
      schoolYearId: currentYear.id,
      classe: {
        branchId,
      },
    },
  });

  const ponderationMap = await getCoursePonderationMap({
    branchId,
    pairs: lessons.map((lesson) => ({
      coursId: lesson.coursId,
      optionId: lesson.classe?.optionId,
    })),
  });

  return lessons.flatMap((lesson) =>
    (lesson.fiche ?? [])
      .map((f) => ({
        id: f.id,
        teacherName: getFicheTeacherUser(f.teacher)?.name ?? "-",
        subjectName: lesson.cours?.nameCours ?? f.coursName ?? "-",
        coursId: lesson.coursId ?? undefined,
        primaryDomain: lesson.cours?.primaryDomain ?? null,
        primarySection: lesson.cours?.primarySection ?? null,
        domainOrder: lesson.cours?.domainOrder ?? null,
        periodName: f.period?.label ?? f.periodeName ?? "-",
        className: lesson.classe?.nameClasse ?? f.classeName ?? "",
        dateCreated: f.dateCreated ? new Date(f.dateCreated).toISOString() : "",
        anneeName: f.anneeName ?? "",
        typeFiche: f.typeFiche ?? null,
        notes: f.notes ? JSON.parse(f.notes) : [],
        autres: f.autres ? JSON.parse(f.autres) : typeFichesDefault,
        coursePonderation: resolveCoursePonderation(ponderationMap, {
          coursId: lesson.coursId,
          optionId: lesson.classe?.optionId,
        }),
      })),
  );
}

export async function checkExistingFiche(params: {
  teacherId: string;
  classId: string;
  lessonId: string;
  periodId: number;
  anneeId: string;
  typeFiche: FicheTypes;
}) {
  try {
    const existing = await prisma.fiche.findFirst({
      where: {
        teacherId: params.teacherId,
        classSectionId: params.classId,
        lessonId: params.lessonId,
        periodId: params.periodId,
        anneeId: params.anneeId,
        typeFiche: params.typeFiche,
      },
    });

    if (existing) {
      return {
        exists: true,
        data: {
          notes: existing.notes ? JSON.parse(existing.notes) : [],
          autres: existing.autres
            ? JSON.parse(existing.autres)
            : typeFichesDefault,
        },
      };
    }

    return { exists: false };
  } catch (error) {
    console.error("Error checking existing fiche:", error);
    return { exists: false };
  }
}

export type FicheCentraleStudentAverage = {
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

export type FicheCentraleSummary = {
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

export async function getFicheCentraleSummary(params: {
  lessonId: string;
  classId: string;
  periodId: number;
  anneeId: string;
}): Promise<FicheCentraleSummary | null> {
  const fiches = await prisma.fiche.findMany({
    where: {
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

export async function validateFicheCentrale(params: {
  lessonId: string;
  classId: string;
  periodId: number;
  anneeId: string;
}) {
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

  const ficheCote = await prisma.fiche.findUnique({
    where: {
      id: summary.ficheCoteId,
    },
    select: {
      id: true,
      notes: true,
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

  await gradeQueue.add(
    "generate-grades",
    { periodId: fiche.periodId },
    {
      jobId: `period-${fiche.periodId}`, // 👈 ULTRA IMPORTANT
      removeOnComplete: true,
      removeOnFail: true,
    },
  );
  revalidatePath("/admin/ficheCentrales");
  revalidatePath(`/admin/fiches/${ficheCote.id}`);
  revalidatePath("/admin/results");

  return {
    success: true,
    message: "La fiche a été validée et les moyennes ont été reportées.",
  };
}
