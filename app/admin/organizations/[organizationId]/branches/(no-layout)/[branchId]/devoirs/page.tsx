import { notFound } from "next/navigation";

import { listAccessibleCursusStudents } from "@/lib/auth/cursus-scope";
import { canManageOrganization } from "@/lib/auth/session-roles";
import { enforceOnlineAssignmentAccess } from "@/lib/online-assignments/access";
import { assignmentBranchWhere } from "@/lib/online-assignments/scope";
import { prisma } from "@/lib/prisma";

import { DevoirsClient } from "./devoirs-client";

export const dynamic = "force-dynamic";

export default async function DevoirsPage({
  params,
}: {
  params: Promise<{ organizationId: string; branchId: string }>;
}) {
  const { organizationId, branchId } = await params;
  let access;
  try {
    access = await enforceOnlineAssignmentAccess();
  } catch {
    notFound();
  }
  if (access.branchId !== branchId) notFound();

  const [currentYear, schoolYears, classes, courses] = await Promise.all([
    prisma.schoolYear.findFirst({
      where: { branchId, isCurrentYear: true, isArchived: false },
      select: { id: true, nameYear: true },
    }),
    prisma.schoolYear.findMany({
      where: { branchId, isArchived: false },
      orderBy: [{ isCurrentYear: "desc" }, { startYear: "desc" }],
      select: { id: true, nameYear: true, isCurrentYear: true },
    }),
    prisma.classe.findMany({
      where: { branchId },
      orderBy: { nameClasse: "asc" },
      select: { id: true, nameClasse: true },
    }),
    prisma.cours.findMany({
      where: { branchId },
      orderBy: { nameCours: "asc" },
      select: { id: true, nameCours: true },
    }),
  ]);

  const filterOptions = {
    schoolYears: schoolYears.map((y) => ({
      id: y.id,
      label: y.isCurrentYear ? `${y.nameYear} (en cours)` : y.nameYear,
      isCurrent: y.isCurrentYear,
    })),
    classes: classes.map((c) => ({ id: c.id, label: c.nameClasse })),
    courses: courses.map((c) => ({ id: c.id, label: c.nameCours })),
    defaultSchoolYearId: currentYear?.id ?? schoolYears[0]?.id ?? "all",
  };

  const mapRow = (
    a: {
      id: string;
      title: string;
      type: string;
      status: string;
      startAt: Date;
      dueAt: Date;
      totalPoints: number;
      resultsPublished: boolean;
      classId: string;
      courseId: string;
      schoolYearId: string;
      classe: { nameClasse: string };
      cours: { nameCours: string };
      schoolYear?: { nameYear: string } | null;
      _count: { questions: number; submissions: number };
    },
    extra?: {
      myStatus?: string | null;
      myScore?: number | null;
      canDelete?: boolean;
    },
  ) => ({
    id: a.id,
    title: a.title,
    type: a.type,
    status: a.status,
    startAt: a.startAt.toISOString(),
    dueAt: a.dueAt.toISOString(),
    totalPoints: a.totalPoints,
    resultsPublished: a.resultsPublished,
    classId: a.classId,
    className: a.classe.nameClasse,
    courseId: a.courseId,
    courseName: a.cours.nameCours,
    schoolYearId: a.schoolYearId,
    schoolYearName: a.schoolYear?.nameYear ?? "",
    questionsCount: a._count.questions,
    submissionsCount: a._count.submissions,
    myStatus: extra?.myStatus ?? null,
    myScore: extra?.myScore ?? null,
    canDelete: Boolean(extra?.canDelete),
  });

  if (access.mode === "manage") {
    const isAdmin = canManageOrganization(access.session);
    const rows = await prisma.onlineAssignment.findMany({
      where: {
        ...assignmentBranchWhere(branchId),
        ...(!isAdmin && access.teacherId
          ? { teacherId: access.teacherId }
          : {}),
      },
      orderBy: [{ dueAt: "desc" }],
      include: {
        classe: { select: { nameClasse: true } },
        cours: { select: { nameCours: true } },
        schoolYear: { select: { nameYear: true } },
        fiche: { select: { id: true } },
        _count: {
          select: {
            questions: true,
            submissions: true,
          },
        },
        submissions: {
          where: { status: "GRADED" },
          select: { id: true },
          take: 1,
        },
      },
    });

    return (
      <DevoirsClient
        mode="manage"
        organizationId={organizationId}
        branchId={branchId}
        filterOptions={filterOptions}
        assignments={rows.map((a) =>
          mapRow(a, {
            canDelete:
              a.status === "DRAFT" ||
              (!a.resultsPublished && !a.fiche && a.submissions.length === 0),
          }),
        )}
      />
    );
  }

  const students = await listAccessibleCursusStudents({
    role: access.role,
    userId: access.userId,
    branchId,
  });
  const classIds = [
    ...new Set(students.map((s) => s.classId).filter(Boolean) as string[]),
  ];
  const studentById = new Map(students.map((s) => [s.id, s]));

  const rows = await prisma.onlineAssignment.findMany({
    where: {
      ...assignmentBranchWhere(branchId),
      status: { in: ["PUBLISHED", "CLOSED"] },
      classId: { in: classIds.length ? classIds : ["__none__"] },
    },
    orderBy: [{ dueAt: "asc" }],
    include: {
      classe: { select: { nameClasse: true } },
      cours: { select: { nameCours: true } },
      schoolYear: { select: { nameYear: true } },
      _count: { select: { questions: true, submissions: true } },
      submissions: {
        where: { studentId: { in: students.map((s) => s.id) } },
        select: {
          studentId: true,
          status: true,
          finalScore: true,
          provisionalScore: true,
        },
      },
    },
  });

  const now = new Date();

  return (
    <DevoirsClient
      mode={access.mode}
      organizationId={organizationId}
      branchId={branchId}
      filterOptions={filterOptions}
      students={students.map((s) => ({ id: s.id, fullName: s.fullName }))}
      assignments={rows.map((a) => {
        // Élève : uniquement sa copie. Parent : enfants de cette classe.
        const relevantSubs = a.submissions.filter((sub) => {
          const st = studentById.get(sub.studentId);
          return st?.classId === a.classId || studentById.has(sub.studentId);
        });
        const selfSub =
          access.mode === "student"
            ? relevantSubs.find((s) => s.studentId === students[0]?.id)
            : relevantSubs[0];
        const open = now >= a.startAt && now <= a.dueAt && a.status === "PUBLISHED";
        const upcoming = now < a.startAt && a.status === "PUBLISHED";

        return {
          ...mapRow(a, {
            myStatus:
              selfSub?.status ??
              (upcoming ? "UPCOMING" : open ? "TODO" : "TODO"),
            myScore: a.resultsPublished
              ? (selfSub?.finalScore ?? selfSub?.provisionalScore ?? null)
              : null,
          }),
          isOpen: open,
          isUpcoming: upcoming,
          learnerStatuses:
            access.mode === "parent"
              ? students
                  .filter((s) => s.classId === a.classId)
                  .map((s) => {
                    const sub = relevantSubs.find((x) => x.studentId === s.id);
                    return {
                      studentId: s.id,
                      fullName: s.fullName,
                      status: sub?.status ?? (upcoming ? "UPCOMING" : "TODO"),
                      score: a.resultsPublished
                        ? (sub?.finalScore ?? sub?.provisionalScore ?? null)
                        : null,
                    };
                  })
              : undefined,
        };
      })}
    />
  );
}
