import { BranchPageShell } from "@/components/layout/branch-page-shell";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import {
  canAccessBranchAreaAsync,
  getBranchAreaMutationFlags,
} from "@/lib/auth/assert-branch-area-access";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { getPeopleLabels } from "@/lib/people-labels";
import {
  canAccessPedagogyArea,
  hasSessionRole,
  isOrganizationOwnerSession,
} from "@/lib/auth/session-roles";
import { ORG_ROLE } from "@/lib/permissions";

import { Badge } from "@/components/ui/badge";
import { IconUser } from "@tabler/icons-react";

import { getTeacherCurrentSessions } from "../../attendance/attendance.action";
import { getStaffBadgeAction } from "../../staff-badge.action";
import { genererCreneaux } from "../components/type";
import { TeacherProfileClient } from "./teacher-profile-client";
import type { TeacherScheduleUI } from "./TeacherScheduleTable";
import {
  getTeacherAssignmentSnapshot,
  resolveDossierAvailability,
  resolveDossierLevels,
  resolveDossierSubjects,
  syncTeacherDossierExperienceYears,
} from "@/lib/teacher-assignment-years";
import { formatAgeLabel, formatBirthDate } from "@/lib/person-age";
import { normalizeCreneauWorkingDays } from "@/lib/creneau-working-days";
import {
  formatScheduleCoursLabel,
  subjectIdsReplacedBySchedulePosts,
} from "@/lib/cours-components";
import type {
  TeacherAttendanceStatus,
  TeacherProfileClass,
  TeacherProfileCourse,
  TeacherProfileData,
} from "./teacher-profile-types";

export const dynamic = "force-dynamic";

function uniqueById<T extends { id: string }>(items: T[]) {
  const map = new Map<string, T>();
  for (const item of items) map.set(item.id, item);
  return [...map.values()];
}

function sexeLabel(sexe: string | null | undefined) {
  if (!sexe) return "—";
  const value = sexe.toUpperCase();
  if (value === "M" || value === "MASCULIN") return "Masculin";
  if (value === "F" || value === "FEMININ") return "Féminin";
  return sexe;
}

const SingleTeacherPage = async ({
  params,
}: {
  params: Promise<{ organizationId: string; branchId: string; id: string }>;
}) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) notFound();

  const { typebranch, branchId, organizationId, userId } =
    await requireBranchContext();
  const peopleLabels = getPeopleLabels(typebranch);
  const { id } = await params;
  const baseHref = `/admin/organizations/${organizationId}/branches/${branchId}`;

  const currentYear = await prisma.schoolYear.findFirst({
    where: { branchId, isCurrentYear: true, isArchived: false },
    select: { id: true, nameYear: true },
  });

  const teacher = await prisma.teacher.findFirst({
    where: {
      branchMember: {
        branchId,
        member: { organizationId },
      },
      OR: [
        { id },
        {
          branchMember: {
            member: { userId: id },
          },
        },
      ],
    },
    include: {
      branchMember: {
        include: {
          member: {
            include: { user: true },
          },
        },
      },
      teaching: {
        where: {
          OR: [{ statusTeaching: true }, { statusTeaching: null }],
          ...(currentYear ? { schoolYearId: currentYear.id } : {}),
          AND: [
            {
              OR: [
                { branchId },
                { branchId: null, classe: { branchId } },
              ],
            },
          ],
        },
        include: {
          cours: {
            select: {
              id: true,
              nameCours: true,
              kind: true,
              parentCoursId: true,
              parentCours: { select: { nameCours: true } },
            },
          },
          classe: {
            select: { id: true, nameClasse: true, codeClasse: true },
          },
          Schedule: true,
        },
      },
    },
  });

  if (!teacher) return notFound();

  const pedagogyFlags = await getBranchAreaMutationFlags(
    "pedagogy",
    session,
    organizationId,
    branchId,
  );
  const canManage = pedagogyFlags.canWrite;
  const canReadPedagogy =
    canAccessPedagogyArea(session) ||
    (await canAccessBranchAreaAsync(
      "pedagogy",
      session,
      organizationId,
      branchId,
    ));
  const isTeacherRole = hasSessionRole(session, [ORG_ROLE.TEACHER, "TEACHER"]);
  const isSelf = teacher.branchMember?.member?.userId === userId;

  if (!canManage && !canReadPedagogy && !(isTeacherRole && isSelf)) {
    notFound();
  }

  const user = teacher.branchMember?.member?.user;
  const firstClasseId = teacher.teaching.find((t) => t.classeId)?.classeId;

  const [
    creneau,
    attendanceSession,
    teacherBadge,
    attendanceRows,
    fiches,
    assignmentCount,
    meetings,
    jobApplication,
    profileDocuments,
    assignmentSnapshot,
  ] = await Promise.all([
    firstClasseId
      ? prisma.creneau.findFirst({
          where: { classe: { some: { id: firstClasseId } } },
        })
      : Promise.resolve(null),
    getTeacherCurrentSessions(teacher.id),
    getStaffBadgeAction("teacher", teacher.id),
    prisma.teacherAttendance.findMany({
      where: { teacherId: teacher.id, branchId },
      orderBy: { date: "desc" },
      take: 24,
      include: {
        session: {
          include: {
            teaching: {
              include: {
                cours: { select: { nameCours: true } },
                classe: { select: { nameClasse: true, codeClasse: true } },
              },
            },
          },
        },
      },
    }),
    prisma.fiche.findMany({
      where: {
        teacherId: teacher.id,
        branchId,
        ...(currentYear ? { anneeId: currentYear.id } : {}),
      },
      orderBy: { dateCreated: "desc" },
      take: 80,
      select: {
        id: true,
        lessonId: true,
        classSectionId: true,
        classeName: true,
        coursName: true,
        typeFiche: true,
        periodeName: true,
        anneeName: true,
        status: true,
        dateCreated: true,
      },
    }),
    prisma.onlineAssignment.count({
      where: {
        teacherId: teacher.id,
        branchId,
        ...(currentYear ? { schoolYearId: currentYear.id } : {}),
      },
    }),
    prisma.calendarEvent.findMany({
      where: {
        branchId,
        isArchived: false,
        ...(currentYear ? { schoolYearId: currentYear.id } : {}),
        OR: [
          ...(teacher.teaching.length
            ? [{ teachingId: { in: teacher.teaching.map((t) => t.id) } }]
            : []),
          ...(teacher.teaching.some((t) => t.classeId)
            ? [
                {
                  classeId: {
                    in: teacher.teaching
                      .map((t) => t.classeId)
                      .filter((value): value is string => Boolean(value)),
                  },
                },
              ]
            : []),
          {
            eventType: {
              name: { contains: "reunion", mode: "insensitive" },
            },
          },
          {
            eventType: {
              name: { contains: "réunion", mode: "insensitive" },
            },
          },
          {
            title: { contains: "reunion", mode: "insensitive" },
          },
          {
            title: { contains: "réunion", mode: "insensitive" },
          },
        ],
      },
      include: {
        eventType: { select: { name: true } },
        classe: { select: { nameClasse: true } },
        teaching: {
          select: { cours: { select: { nameCours: true } } },
        },
      },
      orderBy: { dateStart: "desc" },
      take: 30,
    }),
    prisma.jobApplication.findFirst({
      where: {
        branchId,
        organizationId,
        applicationType: "TEACHER",
        OR: [
          { teacherId: teacher.id },
          ...(user?.email
            ? [{ email: user.email.toLowerCase() }]
            : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        reference: true,
        createdAt: true,
        yearsOfExperience: true,
        desiredSubjects: true,
        desiredLevels: true,
        availability: true,
        experienceSummary: true,
        educationSummary: true,
        skills: true,
        motivation: true,
        cvUrl: true,
        coverLetterUrl: true,
      },
    }),
    prisma.teacherProfileDocument.findMany({
      where: { teacherId: teacher.id, branchId },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, url: true, createdAt: true },
    }),
    getTeacherAssignmentSnapshot({
      teacherId: teacher.id,
      branchId,
    }),
  ]);

  if (jobApplication) {
    await syncTeacherDossierExperienceYears({
      teacherId: teacher.id,
      branchId,
    });
  }

  const assignmentYears = assignmentSnapshot;
  let heuresDebut: string[] = [];
  if (creneau) {
    heuresDebut = genererCreneaux(
      new Date(`2000-01-01T${creneau.startTime}`),
      new Date(`2000-01-01T${creneau.endTime}`),
      creneau.durationCourse,
      new Date(`2000-01-01T${creneau.recreationHour}`),
      creneau.recreationDuration,
    );
  }

  const replacedParentIds = await subjectIdsReplacedBySchedulePosts({
    branchId,
    subjectIds: teacher.teaching
      .map((item) => item.cours?.parentCoursId ?? item.cours?.id)
      .filter((id): id is string => Boolean(id)),
  });
  const scheduleTeachings = teacher.teaching
    .filter((item) => !replacedParentIds.has(item.cours?.id ?? ""))
    .map((item) => ({
      ...item,
      cours: item.cours
        ? {
            ...item.cours,
            nameCours: formatScheduleCoursLabel({
              nameCours: item.cours.nameCours,
              parentNameCours: item.cours.parentCours?.nameCours,
              kind: item.cours.kind,
              parentCoursId: item.cours.parentCoursId,
            }),
          }
        : item.cours,
    }));

  const courses: TeacherProfileCourse[] = teacher.teaching.map((item) => ({
    id: item.id,
    teachingId: item.id,
    courseName: item.cours?.nameCours ?? "Cours",
    classId: item.classe?.id ?? item.classeId,
    className: item.classe?.nameClasse ?? "Classe",
    classCode: item.classe?.codeClasse ?? "",
    titulaire: Boolean(item.titulaire),
  }));

  const classes: TeacherProfileClass[] = uniqueById(
    courses.map((course) => ({
      id: course.classId,
      name: course.className,
      code: course.classCode,
    })),
  ).sort((a, b) => a.name.localeCompare(b.name, "fr"));

  const present = attendanceRows.filter((row) => row.status === "PRESENT").length;
  const absent = attendanceRows.filter((row) => row.status === "ABSENT").length;
  const late = attendanceRows.filter((row) => row.status === "LATE").length;
  const excused = attendanceRows.filter((row) => row.status === "EXCUSED").length;
  const attendanceTotal = attendanceRows.length;
  const presenceRate =
    attendanceTotal > 0
      ? Math.round(((present + excused) / attendanceTotal) * 100)
      : 0;
  const punctualityRate =
    present + late > 0 ? Math.round((present / (present + late)) * 100) : 0;

  // Cours donnés (affectations actives) — cible ~4 cours pour 100 %.
  const coursesRate = Math.min(100, Math.round(courses.length * 25));
  // Interventions effectuées : fiches de notes + devoirs en ligne.
  const interventionsCount = fiches.length + assignmentCount;
  const interventionsRate = Math.min(
    100,
    Math.round(fiches.length * 8 + assignmentCount * 10),
  );

  const score =
    attendanceTotal > 0
      ? Math.round(
          presenceRate * 0.3 +
            punctualityRate * 0.15 +
            coursesRate * 0.25 +
            interventionsRate * 0.3,
        )
      : Math.round(
          Math.max(
            coursesRate * 0.4 + interventionsRate * 0.6,
            courses.length || interventionsCount ? 50 : 0,
          ),
        );

  const now = Date.now();
  const fullName =
    [user?.name, user?.postnom, user?.prenom].filter(Boolean).join(" ") ||
    peopleLabels.teacher;

  const profile: TeacherProfileData = {
    teacherId: teacher.id,
    teacherLabel: peopleLabels.teacher,
    teacherLabelLower: peopleLabels.teacherLower,
    fullName,
    nom: user?.name ?? "",
    prenom: user?.prenom ?? "",
    postnom: user?.postnom ?? "",
    email: user?.email ?? "—",
    telephone: user?.telephone ?? "—",
    address: user?.address ?? "—",
    username: user?.username ?? "",
    sexe: sexeLabel(user?.sexe),
    dateOfBirthLabel: formatBirthDate(user?.dateOfBirth),
    ageLabel: formatAgeLabel(user?.dateOfBirth),
    dateOfBirth: user?.dateOfBirth?.toISOString() ?? null,
    image: user?.image ?? null,
    canManagePhoto: canManage || isSelf,
    canEditIdentity: canManage || isSelf,
    statusActive: user?.statusUser !== false,
    statusLabel: user?.statusUser === false ? "Inactif" : "Actif",
    isTitulaire: teacher.teaching.some((item) => item.titulaire),
    schoolYearLabel: currentYear?.nameYear ?? null,
    baseHref,
    listHref: `${baseHref}/teacher`,
    dashboardHref: baseHref,
    notesHref: `${baseHref}/notes?teacherId=${teacher.id}`,
    notesListHref: `${baseHref}/notes?teacherId=${teacher.id}&view=list`,
    devoirsHref: `${baseHref}/devoirs?teacherId=${teacher.id}`,
    attendanceHref: `${baseHref}/attendance/teacher-attendance`,
    calendarHref: `${baseHref}/settings/calendar`,
    branchType: typebranch ?? "",
    assignmentYearCount: assignmentYears.count,
    assignmentYearLabels: assignmentYears.yearLabels,
    canEditApplicationDocuments: isOrganizationOwnerSession(session),
    profileDocuments: profileDocuments.map((document) => ({
      ...document,
      createdAt: document.createdAt.toISOString(),
    })),
    courses,
    classes,
    application: jobApplication
      ? (() => {
          const subjects = resolveDossierSubjects(
            jobApplication.desiredSubjects,
            assignmentYears.currentSubjects,
          );
          const levels = resolveDossierLevels(
            jobApplication.desiredLevels,
            assignmentYears.currentLevels,
          );
          const availability = resolveDossierAvailability({
            isUserActive: user?.statusUser !== false,
            assignedToCurrentYear: assignmentYears.assignedToCurrentYear,
          });
          return {
            id: jobApplication.id,
            reference: jobApplication.reference,
            submittedAt: jobApplication.createdAt.toISOString(),
            yearsOfExperience: Math.max(
              jobApplication.yearsOfExperience ?? 0,
              assignmentYears.count,
            ),
            assignmentYearLabels: assignmentYears.yearLabels,
            desiredSubjects: subjects.value,
            subjectsSource: subjects.source,
            depositSubjects: jobApplication.desiredSubjects,
            desiredLevels: levels.value,
            levelsSource: levels.source,
            depositLevels: jobApplication.desiredLevels,
            availability: availability.value,
            availabilitySource: availability.source,
            experienceSummary: jobApplication.experienceSummary,
            educationSummary: jobApplication.educationSummary,
            skills: jobApplication.skills,
            motivation: jobApplication.motivation,
            cvUrl: jobApplication.cvUrl,
            coverLetterUrl: jobApplication.coverLetterUrl,
            parcours: assignmentYears.parcours,
          };
        })()
      : null,
    notes: fiches.map((fiche) => ({
      id: fiche.id,
      lessonId: fiche.lessonId,
      classId: fiche.classSectionId,
      className: fiche.classeName,
      courseName: fiche.coursName,
      typeFiche: fiche.typeFiche,
      periodName: fiche.periodeName,
      yearName: fiche.anneeName,
      status: fiche.status,
      createdAt: fiche.dateCreated.toISOString(),
    })),
    attendances: attendanceRows.map((row) => ({
      id: row.id,
      date: row.date.toISOString(),
      status: row.status as TeacherAttendanceStatus,
      checkIn: row.checkIn?.toISOString() ?? null,
      checkOut: row.checkOut?.toISOString() ?? null,
      remark: row.remark,
      courseName: row.session?.teaching?.cours?.nameCours ?? "Cours",
      className:
        row.session?.teaching?.classe?.nameClasse ??
        row.session?.teaching?.classe?.codeClasse ??
        "",
    })),
    meetings: meetings
      .map((event) => ({
        id: event.id,
        title: event.title?.trim() || event.eventType?.name || "Réunion",
        dateStart: event.dateStart.toISOString(),
        dateEnd: event.dateEnd?.toISOString() ?? null,
        location: event.location,
        typeName: event.eventType?.name ?? null,
        className: event.classe?.nameClasse ?? null,
        courseName: event.teaching?.cours?.nameCours ?? null,
        upcoming: event.dateStart.getTime() >= now,
      }))
      .sort((a, b) => {
        if (a.upcoming !== b.upcoming) return a.upcoming ? -1 : 1;
        return a.upcoming
          ? a.dateStart.localeCompare(b.dateStart)
          : b.dateStart.localeCompare(a.dateStart);
      }),
    stats: {
      present,
      absent,
      late,
      excused,
      attendanceTotal,
      presenceRate,
      punctualityRate,
      coursesRate,
      interventionsRate,
      notesCount: fiches.length,
      assignmentsCount: assignmentCount,
      courseCount: courses.length,
      classCount: classes.length,
      score,
    },
    badge: teacherBadge,
    currentSessions: JSON.parse(JSON.stringify(attendanceSession)) as unknown[],
  };

  return (
    <BranchPageShell
      title={`Dossier ${peopleLabels.teacherLower}`}
      description={`Présences, réunions, notes, devoirs et performance du ${peopleLabels.teacherLower}.`}
      backHref={baseHref}
      backLabel="Retour au tableau de bord"
      badge={
        <Badge variant="outline-primary" icon={<IconUser size={14} />}>
          {peopleLabels.teacher}
        </Badge>
      }
      contentClassName="space-y-4"
    >
      <TeacherProfileClient
        profile={profile}
        teaching={scheduleTeachings as TeacherScheduleUI[]}
        hours={heuresDebut}
        workingDays={
          creneau
            ? normalizeCreneauWorkingDays(
                (creneau as { workingDays?: string[] }).workingDays,
              )
            : undefined
        }
      />
    </BranchPageShell>
  );
};

export default SingleTeacherPage;
