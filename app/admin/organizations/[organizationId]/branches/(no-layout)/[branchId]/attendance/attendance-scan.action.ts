"use server";

import { prisma } from "@/lib/prisma";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import {
  assertStudentAttendanceWriteAccess,
  assertTeacherAttendanceWriteAccess,
  getTeacherAttendanceReadScope,
  getTeacherIdForUser,
  getPersonnelIdForUser,
} from "@/lib/auth/data-scope";
import {
  canManageOrganization,
  hasSessionRole,
} from "@/lib/auth/session-roles";
import type { AttendanceGeoCoords } from "@/lib/attendance-geo";
import { assertWithinBranchAttendanceRadius } from "@/lib/attendance-geo.server";
import { formatExpectedSessionLabel } from "@/lib/attendance-schedule-label";
import {
  isBranchClosedOn,
  resolvePersonnelStatusFromSchedule,
} from "@/lib/branch-closed-days";
import {
  findStudentCheckInSession,
  getExpectedStudentSessionLabel,
  listClassScheduleCandidates,
} from "@/lib/attendance-student-session";
import {
  findTeacherCheckInSession,
  getBranchCourseDurationMinutes,
  getExpectedTeacherSessionLabel,
  listTeacherScheduleCandidates,
} from "@/lib/attendance-teacher-session";
import { compareClassesByLevel } from "@/lib/class-structure";
import {
  CYCLE_SORT_ORDER,
  cycleLabel,
  isCycle,
  type Cycle,
} from "@/lib/cycle";
import { ORG_ROLE } from "@/lib/permissions";
import { orgRoleLabel } from "@/lib/org-role-labels";
import {
  Day,
  type AttendanceStatus,
  type Prisma,
} from "@/prisma/generated/prisma/client";
import {
  getParisWeekday,
  isTeacherCheckInWindow,
  nowLocal,
  scheduleHourToMinutes,
  startOfTodayParis,
  toMinutes,
} from "@/lib/timezone";
import { z } from "zod";
import {
  resolveAbsenceIfPresent,
} from "@/lib/attendance-absence";
import type {
  AttendanceCheckInClass,
  AttendanceCheckInCycleGroup,
  AttendanceCheckInResult,
  AttendancePersonLookup,
  AttendancePersonType,
  AttendanceQuickCheckInBootstrap,
} from "./attendance-scan-types";

const scanSchema = z.object({
  code: z.string().trim().min(1, "Code vide."),
});

const searchSchema = z.object({
  query: z.string().trim().min(2, "Saisissez au moins 2 caracteres."),
});

const geoCoordsSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

type ScanTarget = AttendancePersonType | "any";

type ParsedScanCode = {
  target: ScanTarget;
  entityId?: string;
  matricule?: string;
  idSuffix?: string;
};

function getPersonName(user: {
  name: string;
  postnom: string | null;
  prenom: string | null;
}) {
  return [user.name, user.postnom, user.prenom].filter(Boolean).join(" ").trim();
}

function parseScanCode(raw: string): ParsedScanCode | null {
  const value = raw.trim();
  if (!value) return null;

  if (value.startsWith("{")) {
    try {
      const payload = JSON.parse(value) as {
        studentId?: string;
        teacherId?: string;
        personnelId?: string;
        matricule?: string;
        type?: string;
      };

      const type = payload.type?.toLowerCase() ?? "";

      if (payload.teacherId || type.includes("teacher")) {
        return {
          target: "teacher",
          entityId: payload.teacherId,
          matricule: payload.matricule,
        };
      }

      if (payload.personnelId || type.includes("personnel")) {
        return {
          target: "personnel",
          entityId: payload.personnelId,
          matricule: payload.matricule,
        };
      }

      if (payload.studentId || type.includes("student")) {
        return {
          target: "student",
          entityId: payload.studentId,
          matricule: payload.matricule,
        };
      }

      if (payload.matricule) {
        return { target: "any", matricule: payload.matricule };
      }
    } catch {
      // ignore invalid JSON
    }
  }

  if (value.startsWith("ENS-")) {
    const parts = value.split("-");
    return {
      target: "teacher",
      idSuffix: parts[1]?.toUpperCase(),
      matricule: value,
    };
  }

  if (value.startsWith("PRS-")) {
    const parts = value.split("-");
    return {
      target: "personnel",
      idSuffix: parts[1]?.toUpperCase(),
      matricule: value,
    };
  }

  if (value.startsWith("ELV-")) {
    const parts = value.split("-");
    return {
      target: "student",
      idSuffix: parts[1]?.toUpperCase(),
      matricule: value,
    };
  }

  return { target: "any", matricule: value };
}

function userInclude() {
  return {
    branchMember: {
      include: {
        member: {
          include: { user: true },
        },
      },
    },
  };
}

function studentInclude() {
  return {
    ...userInclude(),
    classEnrollment: {
      where: { statusEnrollment: { not: false } },
      orderBy: { createdAt: "desc" as const },
      take: 1,
      include: {
        classe: {
          select: {
            nameClasse: true,
            codeClasse: true,
          },
        },
      },
    },
  };
}

async function findStudentByScan(
  branchId: string,
  organizationId: string,
  parsed: ParsedScanCode,
) {
  if (parsed.entityId) {
    return prisma.student.findFirst({
      where: {
        id: parsed.entityId,
        branchMember: { branchId, branch: { organizationId } },
      },
      include: studentInclude(),
    });
  }

  if (parsed.matricule) {
    const byUsername = await prisma.student.findFirst({
      where: {
        branchMember: {
          branchId,
          branch: { organizationId },
          member: {
            user: {
              username: { equals: parsed.matricule, mode: "insensitive" },
            },
          },
        },
      },
      include: studentInclude(),
    });
    if (byUsername) return byUsername;
  }

  if (parsed.idSuffix) {
    const candidates = await prisma.student.findMany({
      where: {
        branchMember: { branchId, branch: { organizationId } },
        id: { endsWith: parsed.idSuffix.toLowerCase() },
      },
      include: studentInclude(),
      take: 2,
    });
    if (candidates.length === 1) return candidates[0];
  }

  return null;
}

async function findTeacherByScan(
  branchId: string,
  organizationId: string,
  parsed: ParsedScanCode,
) {
  if (parsed.entityId) {
    return prisma.teacher.findFirst({
      where: {
        id: parsed.entityId,
        branchMember: { branchId, branch: { organizationId } },
      },
      include: userInclude(),
    });
  }

  if (parsed.matricule) {
    const byUsername = await prisma.teacher.findFirst({
      where: {
        branchMember: {
          branchId,
          branch: { organizationId },
          member: {
            user: {
              username: { equals: parsed.matricule, mode: "insensitive" },
            },
          },
        },
      },
      include: userInclude(),
    });
    if (byUsername) return byUsername;
  }

  if (parsed.idSuffix) {
    const candidates = await prisma.teacher.findMany({
      where: {
        branchMember: { branchId, branch: { organizationId } },
        id: { endsWith: parsed.idSuffix.toLowerCase() },
      },
      include: userInclude(),
      take: 2,
    });
    if (candidates.length === 1) return candidates[0];
  }

  return null;
}

async function findPersonnelByScan(
  branchId: string,
  organizationId: string,
  parsed: ParsedScanCode,
) {
  if (parsed.entityId) {
    return prisma.personnel.findFirst({
      where: {
        id: parsed.entityId,
        branchMember: { branchId, branch: { organizationId } },
      },
      include: userInclude(),
    });
  }

  if (parsed.matricule) {
    const byUsername = await prisma.personnel.findFirst({
      where: {
        branchMember: {
          branchId,
          branch: { organizationId },
          member: {
            user: {
              username: { equals: parsed.matricule, mode: "insensitive" },
            },
          },
        },
      },
      include: userInclude(),
    });
    if (byUsername) return byUsername;
  }

  if (parsed.idSuffix) {
    const candidates = await prisma.personnel.findMany({
      where: {
        branchMember: { branchId, branch: { organizationId } },
        id: { endsWith: parsed.idSuffix.toLowerCase() },
      },
      include: userInclude(),
      take: 2,
    });
    if (candidates.length === 1) return candidates[0];
  }

  return null;
}

async function resolvePersonFromScan(
  branchId: string,
  organizationId: string,
  parsed: ParsedScanCode,
): Promise<
  | { type: "student"; record: NonNullable<Awaited<ReturnType<typeof findStudentByScan>>> }
  | { type: "teacher"; record: NonNullable<Awaited<ReturnType<typeof findTeacherByScan>>> }
  | { type: "personnel"; record: NonNullable<Awaited<ReturnType<typeof findPersonnelByScan>>> }
  | null
> {
  const targets: ScanTarget[] =
    parsed.target === "any"
      ? ["student", "teacher", "personnel"]
      : [parsed.target];

  for (const target of targets) {
    if (target === "student") {
      const student = await findStudentByScan(branchId, organizationId, parsed);
      if (student) return { type: "student", record: student };
    }

    if (target === "teacher") {
      const teacher = await findTeacherByScan(branchId, organizationId, parsed);
      if (teacher) return { type: "teacher", record: teacher };
    }

    if (target === "personnel") {
      const personnel = await findPersonnelByScan(branchId, organizationId, parsed);
      if (personnel) return { type: "personnel", record: personnel };
    }
  }

  return null;
}

function mapStudentLookup(
  student: NonNullable<Awaited<ReturnType<typeof findStudentByScan>>>,
): AttendancePersonLookup {
  const user = student.branchMember?.member?.user;
  const enrollment = student.classEnrollment[0];
  const className =
    enrollment?.classe?.nameClasse ??
    enrollment?.classe?.codeClasse ??
    "Non assigne";

  return {
    id: student.id,
    name: user ? getPersonName(user) : "Eleve",
    matricule: user?.username ?? student.id.slice(-8).toUpperCase(),
    roleLabel: className,
    personType: "student",
    image: user?.image ?? null,
  };
}

function mapTeacherLookup(
  teacher: NonNullable<Awaited<ReturnType<typeof findTeacherByScan>>>,
): AttendancePersonLookup {
  const user = teacher.branchMember?.member?.user;

  return {
    id: teacher.id,
    name: user ? getPersonName(user) : "Enseignant",
    matricule: user?.username ?? teacher.id.slice(-8).toUpperCase(),
    roleLabel: "Enseignant",
    personType: "teacher",
    image: user?.image ?? null,
  };
}

function mapPersonnelLookup(
  personnel: NonNullable<Awaited<ReturnType<typeof findPersonnelByScan>>>,
): AttendancePersonLookup {
  const user = personnel.branchMember?.member?.user;
  const memberRole = personnel.branchMember?.member?.role;

  return {
    id: personnel.id,
    name: user ? getPersonName(user) : "Personnel",
    matricule: user?.username ?? personnel.id.slice(-8).toUpperCase(),
    roleLabel: memberRole ? orgRoleLabel(memberRole) : "Personnel",
    personType: "personnel",
    image: user?.image ?? null,
  };
}

function resolveStatusFromTime(reference: Date) {
  const now = nowLocal();
  const lateThreshold = scheduleHourToMinutes(reference) + 10;
  return toMinutes(now) > lateThreshold ? ("LATE" as const) : ("PRESENT" as const);
}

/** Enseignant : 1 minute après le début = retard (signalé). La franchise paie est séparée. */
function resolveTeacherStatusFromTime(reference: Date) {
  const now = nowLocal();
  return toMinutes(now) > scheduleHourToMinutes(reference)
    ? ("LATE" as const)
    : ("PRESENT" as const);
}

function sessionInclude() {
  return {
    teaching: {
      include: {
        cours: { select: { nameCours: true } },
        classe: { select: { codeClasse: true, nameClasse: true } },
      },
    },
  };
}

type AttendanceSessionWithTeaching = Prisma.AttendanceSessionGetPayload<{
  include: ReturnType<typeof sessionInclude>;
}>;

function formatSessionLabel(session: {
  startTime: Date;
  teaching?: {
    cours?: { nameCours: string | null } | null;
    classe?: { codeClasse: string | null; nameClasse: string | null } | null;
  } | null;
}) {
  return formatExpectedSessionLabel(session.startTime, session.teaching);
}

async function findSessionForStudent(
  studentId: string,
  branchId: string,
): Promise<AttendanceSessionWithTeaching | null> {
  return findStudentCheckInSession(
    studentId,
    branchId,
    sessionInclude(),
  ) as Promise<AttendanceSessionWithTeaching | null>;
}

async function findSessionForTeacher(
  teacherId: string,
  branchId: string,
): Promise<AttendanceSessionWithTeaching | null> {
  return findTeacherCheckInSession(
    teacherId,
    branchId,
    sessionInclude(),
  ) as Promise<AttendanceSessionWithTeaching | null>;
}

function buildAlreadyCheckedInResult(
  lookup: AttendancePersonLookup,
  status: AttendanceStatus,
  sessionLabel: string,
  checkedAt: Date,
): AttendanceCheckInResult {
  const isKnownCheckInStatus = status === "PRESENT" || status === "LATE";
  return {
    ok: false,
    message: `${lookup.name} a deja pointe pour ce cours a cette heure.`,
    personType: lookup.personType,
    person: lookup,
    status: isKnownCheckInStatus ? status : undefined,
    statusLabel: status === "LATE" ? "Retard" : status === "PRESENT" ? "Present" : undefined,
    sessionLabel,
    checkedAt: checkedAt.toISOString(),
  };
}

function buildNeedsCheckoutResult(
  lookup: AttendancePersonLookup,
  attendanceId: string,
  status: AttendanceStatus,
  sessionLabel: string,
  checkedAt: Date,
): AttendanceCheckInResult {
  const isKnownCheckInStatus = status === "PRESENT" || status === "LATE";
  return {
    ok: false,
    needsCheckout: true,
    attendanceId,
    message: `${lookup.name} est déjà pointé(e) à l'arrivée. Encodez la sortie (normale ou anticipée avec motif).`,
    personType: lookup.personType,
    person: lookup,
    status: isKnownCheckInStatus ? status : undefined,
    statusLabel: status === "LATE" ? "Retard" : status === "PRESENT" ? "Present" : undefined,
    sessionLabel,
    checkedAt: checkedAt.toISOString(),
  };
}

function buildSuccessResult(
  lookup: AttendancePersonLookup,
  status: "PRESENT" | "LATE",
  sessionLabel: string,
  now: Date,
): AttendanceCheckInResult {
  return {
    ok: true,
    message:
      status === "LATE"
        ? `${lookup.name} pointe en retard.`
        : `${lookup.name} pointe avec succes.`,
    personType: lookup.personType,
    person: lookup,
    status,
    statusLabel: status === "LATE" ? "Retard" : "Present",
    sessionLabel,
    checkedAt: now.toISOString(),
  };
}

async function authorizeScanActor(params: {
  personType: AttendancePersonType;
  personId: string;
  sessionId?: string;
}): Promise<void> {
  const { branchId, session, userId } = await requireBranchContext();

  if (canManageOrganization(session)) {
    return;
  }

  if (params.personType === "personnel") {
    const personnelId = await getPersonnelIdForUser(userId, branchId);
    if (personnelId && params.personId === personnelId) {
      return;
    }
    throw new Error(
      "Seuls les responsables peuvent pointer le personnel.",
    );
  }

  if (hasSessionRole(session, [ORG_ROLE.TEACHER, "TEACHER"])) {
    const teacherId = await getTeacherIdForUser(userId, branchId);
    if (!teacherId) {
      throw new Error("Profil enseignant introuvable.");
    }

    if (params.personType === "teacher") {
      if (params.personId !== teacherId) {
        throw new Error("Vous ne pouvez pointer que votre propre presence.");
      }
      if (!params.sessionId) {
        throw new Error(
          "Pointage possible uniquement autour de l'heure de votre cours.",
        );
      }
      await assertTeacherAttendanceWriteAccess({
        session,
        userId,
        branchId,
        sessionId: params.sessionId,
        teacherId,
      });
      return;
    }

    if (params.personType === "student") {
      if (!params.sessionId) {
        throw new Error(
          "Pointage possible uniquement autour de l'heure de votre cours.",
        );
      }
      await assertStudentAttendanceWriteAccess({
        session,
        userId,
        branchId,
        sessionId: params.sessionId,
        studentId: params.personId,
      });
      return;
    }
  }

  throw new Error("Acces non autorise pour ce pointage.");
}

async function ensureCheckInWithinRadius(params: {
  branchId: string;
  coords: AttendanceGeoCoords;
  personType: AttendancePersonType;
  person: AttendancePersonLookup;
}): Promise<AttendanceCheckInResult | null> {
  try {
    await assertWithinBranchAttendanceRadius({
      branchId: params.branchId,
      latitude: params.coords.latitude,
      longitude: params.coords.longitude,
    });
    return null;
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Hors zone de pointage.",
      personType: params.personType,
      person: params.person,
    };
  }
}

async function performStudentCheckIn(
  student: NonNullable<Awaited<ReturnType<typeof findStudentByScan>>>,
  coords: AttendanceGeoCoords,
): Promise<AttendanceCheckInResult> {
  const { branchId, session, userId } = await requireBranchContext();
  const lookup = mapStudentLookup(student);

  const geoError = await ensureCheckInWithinRadius({
    branchId,
    coords,
    personType: "student",
    person: lookup,
  });
  if (geoError) return geoError;

  const attendanceSession = await findSessionForStudent(student.id, branchId);

  if (!attendanceSession) {
    return {
      ok: false,
      message: "Aucune session de cours disponible pour cet eleve aujourd'hui.",
      personType: "student",
      person: lookup,
    };
  }

  try {
    await authorizeScanActor({
      personType: "student",
      personId: student.id,
      sessionId: attendanceSession.id,
    });
    await assertStudentAttendanceWriteAccess({
      session,
      userId,
      branchId,
      sessionId: attendanceSession.id,
      studentId: student.id,
    });
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Pointage eleve non autorise.",
      personType: "student",
      person: lookup,
    };
  }

  const status = resolveStatusFromTime(attendanceSession.startTime);
  const now = nowLocal();
  const sessionLabel = formatSessionLabel(attendanceSession);

  const existingAttendance = await prisma.studentAttendance.findUnique({
    where: {
      branchId_sessionId_studentId: {
        branchId,
        sessionId: attendanceSession.id,
        studentId: student.id,
      },
    },
  });

  if (existingAttendance) {
    if (
      existingAttendance.checkIn &&
      !existingAttendance.checkOut &&
      !existingAttendance.earlyExit
    ) {
      return buildNeedsCheckoutResult(
        lookup,
        existingAttendance.id,
        existingAttendance.status,
        sessionLabel,
        existingAttendance.checkIn ?? existingAttendance.recordedAt,
      );
    }

    return buildAlreadyCheckedInResult(
      lookup,
      existingAttendance.status,
      sessionLabel,
      existingAttendance.checkIn ?? existingAttendance.recordedAt,
    );
  }

  await prisma.studentAttendance.upsert({
    where: {
      branchId_sessionId_studentId: {
        branchId,
        sessionId: attendanceSession.id,
        studentId: student.id,
      },
    },
    update: {
      status,
      recordedAt: now,
      checkIn: now,
    },
    create: {
      branchId,
      sessionId: attendanceSession.id,
      studentId: student.id,
      status,
      recordedAt: now,
      checkIn: now,
    },
  });

  void resolveAbsenceIfPresent({
    branchId,
    sourceKey: `student:${attendanceSession.id}:${student.id}`,
  }).catch((error) => {
    console.error("[performStudentCheckIn] absence sync", error);
  });

  return buildSuccessResult(lookup, status, sessionLabel, now);
}

async function performTeacherCheckIn(
  teacher: NonNullable<Awaited<ReturnType<typeof findTeacherByScan>>>,
  coords: AttendanceGeoCoords,
): Promise<AttendanceCheckInResult> {
  const { branchId, session, userId } = await requireBranchContext();
  const lookup = mapTeacherLookup(teacher);

  const geoError = await ensureCheckInWithinRadius({
    branchId,
    coords,
    personType: "teacher",
    person: lookup,
  });
  if (geoError) return geoError;

  const attendanceSession = await findSessionForTeacher(teacher.id, branchId);

  if (!attendanceSession) {
    return {
      ok: false,
      message:
        "Aucune session de cours disponible pour cet enseignant maintenant. Le pointage est ouvert a partir de 15 minutes avant le debut du cours.",
      personType: "teacher",
      person: lookup,
    };
  }

  const hydratedSession = await prisma.attendanceSession.findFirst({
    where: { id: attendanceSession.id, branchId },
    include: sessionInclude(),
  });

  if (!hydratedSession) {
    return {
      ok: false,
      message: "Session de cours introuvable pour cet enseignant.",
      personType: "teacher",
      person: lookup,
    };
  }

  try {
    await authorizeScanActor({
      personType: "teacher",
      personId: teacher.id,
      sessionId: hydratedSession.id,
    });
    await assertTeacherAttendanceWriteAccess({
      session,
      userId,
      branchId,
      sessionId: hydratedSession.id,
      teacherId: teacher.id,
    });
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Pointage enseignant non autorise.",
      personType: "teacher",
      person: lookup,
    };
  }

  const status = resolveTeacherStatusFromTime(hydratedSession.startTime);
  const now = nowLocal();
  const sessionLabel = formatSessionLabel(hydratedSession);

  const existingAttendance = await prisma.teacherAttendance.findUnique({
    where: {
      teacherId_sessionId_branchId: {
        teacherId: teacher.id,
        sessionId: hydratedSession.id,
        branchId,
      },
    },
  });

  if (existingAttendance) {
    if (
      existingAttendance.checkIn &&
      !existingAttendance.checkOut &&
      !existingAttendance.earlyExit
    ) {
      return buildNeedsCheckoutResult(
        lookup,
        existingAttendance.id,
        existingAttendance.status,
        sessionLabel,
        existingAttendance.checkIn ?? existingAttendance.date,
      );
    }

    return buildAlreadyCheckedInResult(
      lookup,
      existingAttendance.status,
      sessionLabel,
      existingAttendance.checkIn ?? existingAttendance.date,
    );
  }

  await prisma.teacherAttendance.upsert({
    where: {
      teacherId_sessionId_branchId: {
        teacherId: teacher.id,
        sessionId: hydratedSession.id,
        branchId,
      },
    },
    update: {
      status,
      date: now,
      checkIn: now,
    },
    create: {
      branchId,
      sessionId: hydratedSession.id,
      teacherId: teacher.id,
      status,
      date: now,
      checkIn: now,
    },
  });

  void resolveAbsenceIfPresent({
    branchId,
    sourceKey: `teacher:${hydratedSession.id}:${teacher.id}`,
  }).catch((error) => {
    console.error("[performTeacherCheckIn] absence sync", error);
  });

  return buildSuccessResult(lookup, status, sessionLabel, now);
}

async function performPersonnelCheckIn(
  personnel: NonNullable<Awaited<ReturnType<typeof findPersonnelByScan>>>,
  coords: AttendanceGeoCoords,
): Promise<AttendanceCheckInResult> {
  const { branchId, session, userId } = await requireBranchContext();

  const lookup = mapPersonnelLookup(personnel);

  const myPersonnelId = await getPersonnelIdForUser(userId, branchId);
  if (
    !canManageOrganization(session) &&
    myPersonnelId !== personnel.id
  ) {
    return {
      ok: false,
      message: "Seuls les responsables peuvent pointer le personnel.",
      personType: "personnel",
      person: lookup,
    };
  }

  const geoError = await ensureCheckInWithinRadius({
    branchId,
    coords,
    personType: "personnel",
    person: lookup,
  });
  if (geoError) return geoError;

  if (await isBranchClosedOn(branchId)) {
    return {
      ok: false,
      message:
        "Établissement fermé aujourd'hui (jour férié) — pas de pointage.",
      personType: "personnel",
      person: lookup,
    };
  }

  const now = nowLocal();
  const today = startOfTodayParis(now);
  const status = await resolvePersonnelStatusFromSchedule(branchId, now);

  const existingAttendance = await prisma.personnelAttendance.findUnique({
    where: {
      personnelId_date_branchId: {
        personnelId: personnel.id,
        date: today,
        branchId,
      },
    },
  });

  if (existingAttendance?.checkIn) {
    if (!existingAttendance.checkOut && !existingAttendance.earlyExit) {
      return buildNeedsCheckoutResult(
        lookup,
        existingAttendance.id,
        existingAttendance.status,
        "Presence journaliere",
        existingAttendance.checkIn,
      );
    }

    return buildAlreadyCheckedInResult(
      lookup,
      existingAttendance.status,
      "Presence journaliere",
      existingAttendance.checkIn,
    );
  }

  await prisma.personnelAttendance.upsert({
    where: {
      personnelId_date_branchId: {
        personnelId: personnel.id,
        date: today,
        branchId,
      },
    },
    update: {
      status,
      checkIn: now,
    },
    create: {
      branchId,
      personnelId: personnel.id,
      date: today,
      status,
      checkIn: now,
    },
  });

  const dayKey = startOfTodayParis(today).toISOString().slice(0, 10);
  void resolveAbsenceIfPresent({
    branchId,
    sourceKey: `personnel:${dayKey}:${personnel.id}`,
  }).catch((error) => {
    console.error("[performPersonnelCheckIn] absence sync", error);
  });

  return buildSuccessResult(lookup, status, "Presence journaliere", now);
}

export async function searchPeopleForCheckInAction(
  query: string,
): Promise<AttendancePersonLookup[]> {
  const { branchId, organizationId, session, userId } =
    await requireBranchContext();
  const { query: search } = searchSchema.parse({ query });
  const teacherScope = await getTeacherAttendanceReadScope({
    session,
    userId,
    branchId,
  });

  const userFilter = {
    OR: [
      { username: { contains: search, mode: "insensitive" as const } },
      { name: { contains: search, mode: "insensitive" as const } },
      { prenom: { contains: search, mode: "insensitive" as const } },
      { postnom: { contains: search, mode: "insensitive" as const } },
    ],
  };

  const branchFilter = {
    branchId,
    branch: { organizationId },
    member: { user: userFilter },
  };

  let activeClassIds: string[] | null = null;
  if (teacherScope) {
    const candidates = await listTeacherScheduleCandidates(
      teacherScope.teacherId,
      branchId,
    );
    if (!candidates.length) {
      const selfTeacher = await prisma.teacher.findFirst({
        where: { id: teacherScope.teacherId, branchMember: branchFilter },
        include: userInclude(),
      });
      if (!selfTeacher) return [];
      return [
        {
          ...mapTeacherLookup(selfTeacher),
          expectedSessionLabel: await getExpectedTeacherSessionLabel(
            selfTeacher.id,
            branchId,
          ),
        },
      ];
    }

    const teachings = await prisma.teaching.findMany({
      where: { id: { in: candidates.map((c) => c.teachingId) } },
      select: { classeId: true },
    });
    activeClassIds = [...new Set(teachings.map((t) => t.classeId))];
  }

  const [students, teachers, personnels] = await Promise.all([
    prisma.student.findMany({
      where: {
        branchMember: branchFilter,
        ...(activeClassIds
          ? {
              classEnrollment: {
                some: {
                  branchId,
                  classeId: { in: activeClassIds },
                  schoolYear: { isCurrentYear: true, branchId },
                },
              },
            }
          : {}),
      },
      include: studentInclude(),
      take: 4,
      orderBy: { createdAt: "desc" },
    }),
    prisma.teacher.findMany({
      where: {
        branchMember: branchFilter,
        ...(teacherScope ? { id: teacherScope.teacherId } : {}),
      },
      include: userInclude(),
      take: 4,
      orderBy: { createdAt: "desc" },
    }),
    teacherScope
      ? Promise.resolve([])
      : prisma.personnel.findMany({
          where: { branchMember: branchFilter },
          include: userInclude(),
          take: 4,
          orderBy: { createdAt: "desc" },
        }),
  ]);

  const studentLookups = await Promise.all(
    students.map(async (student) => ({
      ...mapStudentLookup(student),
      expectedSessionLabel: await getExpectedStudentSessionLabel(
        student.id,
        branchId,
      ),
    })),
  );

  const teacherLookups = await Promise.all(
    teachers.map(async (teacher) => ({
      ...mapTeacherLookup(teacher),
      expectedSessionLabel: await getExpectedTeacherSessionLabel(
        teacher.id,
        branchId,
      ),
    })),
  );

  return [
    ...studentLookups,
    ...teacherLookups,
    ...personnels.map(mapPersonnelLookup),
  ].slice(0, 8);
}

/** @deprecated Use searchPeopleForCheckInAction */
export async function searchStudentsForCheckInAction(query: string) {
  return searchPeopleForCheckInAction(query);
}

export async function checkInByScanAction(
  code: string,
  coords: AttendanceGeoCoords,
): Promise<AttendanceCheckInResult | null> {
  const { branchId, organizationId } = await requireBranchContext();
  const { code: rawCode } = scanSchema.parse({ code });
  const parsedCoords = geoCoordsSchema.parse(coords);
  const parsed = parseScanCode(rawCode);

  if (!parsed) {
    return null;
  }

  const resolved = await resolvePersonFromScan(branchId, organizationId, parsed);
  if (!resolved) {
    return null;
  }

  if (resolved.type === "student") {
    return performStudentCheckIn(resolved.record, parsedCoords);
  }

  if (resolved.type === "teacher") {
    return performTeacherCheckIn(resolved.record, parsedCoords);
  }

  return performPersonnelCheckIn(resolved.record, parsedCoords);
}

/** @deprecated Use checkInByScanAction */
export async function checkInStudentByScanAction(
  code: string,
  coords: AttendanceGeoCoords,
) {
  return checkInByScanAction(code, coords);
}

export async function checkInPersonByIdAction(
  personType: AttendancePersonType,
  personId: string,
  coords: AttendanceGeoCoords,
): Promise<AttendanceCheckInResult> {
  const { branchId, organizationId } = await requireBranchContext();
  const parsedCoords = geoCoordsSchema.parse(coords);

  if (personType === "student") {
    const student = await prisma.student.findFirst({
      where: {
        id: personId,
        branchMember: { branchId, branch: { organizationId } },
      },
      include: studentInclude(),
    });

    if (!student) {
      return { ok: false, message: "Eleve introuvable dans cette branche." };
    }

    return performStudentCheckIn(student, parsedCoords);
  }

  if (personType === "teacher") {
    const teacher = await prisma.teacher.findFirst({
      where: {
        id: personId,
        branchMember: { branchId, branch: { organizationId } },
      },
      include: userInclude(),
    });

    if (!teacher) {
      return { ok: false, message: "Enseignant introuvable dans cette branche." };
    }

    return performTeacherCheckIn(teacher, parsedCoords);
  }

  const personnel = await prisma.personnel.findFirst({
    where: {
      id: personId,
      branchMember: { branchId, branch: { organizationId } },
    },
    include: userInclude(),
  });

  if (!personnel) {
    return { ok: false, message: "Personnel introuvable dans cette branche." };
  }

  return performPersonnelCheckIn(personnel, parsedCoords);
}

/** @deprecated Use checkInPersonByIdAction */
export async function checkInStudentByIdAction(
  studentId: string,
  coords: AttendanceGeoCoords,
) {
  return checkInPersonByIdAction("student", studentId, coords);
}

/** Trouve une présence ouverte (arrivée sans sortie) pour encoder la sortie. */
export async function findOpenCheckoutForPersonAction(
  personType: AttendancePersonType,
  personId: string,
): Promise<AttendanceCheckInResult | null> {
  const { branchId, organizationId } = await requireBranchContext();
  const now = nowLocal();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);

  if (personType === "student") {
    const student = await prisma.student.findFirst({
      where: {
        id: personId,
        branchMember: { branchId, branch: { organizationId } },
      },
      include: studentInclude(),
    });
    if (!student) return null;
    const lookup = mapStudentLookup(student);
    const open = await prisma.studentAttendance.findFirst({
      where: {
        branchId,
        studentId: personId,
        checkIn: { not: null },
        checkOut: null,
        earlyExit: false,
        status: { in: ["PRESENT", "LATE", "EXCUSED"] },
        session: { date: { gte: today, lte: end } },
      },
      orderBy: { recordedAt: "desc" },
    });
    if (!open?.checkIn) {
      return {
        ok: false,
        message: `${lookup.name} n'a pas de pointage d'arrivée ouvert aujourd'hui.`,
        personType: "student",
        person: lookup,
      };
    }
    return buildNeedsCheckoutResult(
      lookup,
      open.id,
      open.status,
      "Session du jour",
      open.checkIn,
    );
  }

  if (personType === "teacher") {
    const teacher = await prisma.teacher.findFirst({
      where: {
        id: personId,
        branchMember: { branchId, branch: { organizationId } },
      },
      include: userInclude(),
    });
    if (!teacher) return null;
    const lookup = mapTeacherLookup(teacher);
    const open = await prisma.teacherAttendance.findFirst({
      where: {
        branchId,
        teacherId: personId,
        date: { gte: today, lte: end },
        checkIn: { not: null },
        checkOut: null,
        earlyExit: false,
        status: { in: ["PRESENT", "LATE", "EXCUSED"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!open?.checkIn) {
      return {
        ok: false,
        message: `${lookup.name} n'a pas de pointage d'arrivée ouvert aujourd'hui.`,
        personType: "teacher",
        person: lookup,
      };
    }
    return buildNeedsCheckoutResult(
      lookup,
      open.id,
      open.status,
      "Cours du jour",
      open.checkIn,
    );
  }

  const personnel = await prisma.personnel.findFirst({
    where: {
      id: personId,
      branchMember: { branchId, branch: { organizationId } },
    },
    include: userInclude(),
  });
  if (!personnel) return null;
  const lookup = mapPersonnelLookup(personnel);
  const open = await prisma.personnelAttendance.findFirst({
    where: {
      branchId,
      personnelId: personId,
      date: today,
      checkIn: { not: null },
      checkOut: null,
      earlyExit: false,
    },
  });
  if (!open?.checkIn) {
    return {
      ok: false,
      message: `${lookup.name} n'a pas de pointage d'arrivée ouvert aujourd'hui.`,
      personType: "personnel",
      person: lookup,
    };
  }
  return buildNeedsCheckoutResult(
    lookup,
    open.id,
    open.status,
    "Presence journaliere",
    open.checkIn,
  );
}

const DAY_BY_WEEKDAY = {
  0: Day.Dimanche,
  1: Day.Lundi,
  2: Day.Mardi,
  3: Day.Mercredi,
  4: Day.Jeudi,
  5: Day.Vendredi,
  6: Day.Samedi,
} as const;

function teachingBranchWhere(branchId: string) {
  return {
    OR: [{ branchId }, { branchId: null, classe: { branchId } }],
    schoolYear: {
      branchId,
      isCurrentYear: true,
    },
  };
}

function attendanceOpenState(row?: {
  id: string;
  checkIn: Date | null;
  checkOut: Date | null;
  earlyExit: boolean;
} | null) {
  if (!row?.checkIn) {
    return {
      alreadyCheckedIn: false,
      canCheckOut: false,
      attendanceId: null as string | null,
    };
  }

  const canCheckOut = !row.checkOut && !row.earlyExit;
  return {
    alreadyCheckedIn: true,
    canCheckOut,
    attendanceId: canCheckOut ? row.id : null,
  };
}

function rankWindowStart(
  startMinutes: number,
  currentMinutes: number,
  existingStart: number | null,
) {
  if (existingStart == null) return true;
  const nextDistance = Math.abs(startMinutes - currentMinutes);
  const existingDistance = Math.abs(existingStart - currentMinutes);
  const nextUpcoming = startMinutes >= currentMinutes;
  const existingUpcoming = existingStart >= currentMinutes;
  if (nextUpcoming !== existingUpcoming) return nextUpcoming;
  if (nextDistance !== existingDistance) return nextDistance < existingDistance;
  return startMinutes < existingStart;
}

type WindowSchedule = {
  startMinutes: number;
  hour: Date;
  teachingId: string;
  teacherId: string | null;
  classeId: string | null;
  sessionLabel: string;
  teacher: NonNullable<Awaited<ReturnType<typeof findTeacherByScan>>> | null;
};

async function listTodayWindowSchedules(branchId: string) {
  const now = nowLocal();
  if (await isBranchClosedOn(branchId, now)) {
    return {
      currentMinutes: toMinutes(now),
      startOfDay: startOfTodayParis(now),
      items: [] as WindowSchedule[],
    };
  }

  const currentMinutes = toMinutes(now);
  const courseDurationMinutes = await getBranchCourseDurationMinutes(branchId);
  const today = DAY_BY_WEEKDAY[getParisWeekday(now) as keyof typeof DAY_BY_WEEKDAY];

  const schedules = await prisma.schedule.findMany({
    where: {
      day: today,
      isArchived: false,
      teaching: teachingBranchWhere(branchId),
    },
    include: {
      teaching: {
        include: {
          teacher: { include: userInclude() },
          cours: { select: { nameCours: true } },
          classe: {
            select: {
              id: true,
              codeClasse: true,
              nameClasse: true,
            },
          },
        },
      },
    },
  });

  const items: WindowSchedule[] = [];

  for (const schedule of schedules) {
    if (!schedule.hour || !schedule.teaching) continue;
    const startMinutes = scheduleHourToMinutes(schedule.hour);
    if (
      !isTeacherCheckInWindow(
        currentMinutes,
        startMinutes,
        courseDurationMinutes,
      )
    ) {
      continue;
    }

    const teacher = schedule.teaching.teacher;
    if (teacher?.branchMember?.branchId && teacher.branchMember.branchId !== branchId) {
      continue;
    }

    items.push({
      startMinutes,
      hour: schedule.hour,
      teachingId: schedule.teaching.id,
      teacherId: schedule.teaching.teacherId,
      classeId: schedule.teaching.classeId,
      sessionLabel: formatExpectedSessionLabel(schedule.hour, schedule.teaching),
      teacher: teacher ?? null,
    });
  }

  return {
    currentMinutes,
    startOfDay: startOfTodayParis(now),
    items,
  };
}

export async function getQuickCheckInBootstrapAction(): Promise<AttendanceQuickCheckInBootstrap> {
  const { branchId, session, userId } = await requireBranchContext();
  const teacherScope = await getTeacherAttendanceReadScope({
    session,
    userId,
    branchId,
  });

  const { currentMinutes, startOfDay, items } = await listTodayWindowSchedules(
    branchId,
  );

  const teacherBest = new Map<
    string,
    { startMinutes: number; sessionLabel: string; teachingId: string; hour: Date; teacher: NonNullable<WindowSchedule["teacher"]> }
  >();

  const classBest = new Map<
    string,
    { startMinutes: number; sessionLabel: string }
  >();

  for (const item of items) {
    if (
      item.teacherId &&
      item.teacher &&
      (!teacherScope || teacherScope.teacherId === item.teacherId)
    ) {
      const existing = teacherBest.get(item.teacherId);
      if (
        rankWindowStart(
          item.startMinutes,
          currentMinutes,
          existing?.startMinutes ?? null,
        )
      ) {
        teacherBest.set(item.teacherId, {
          startMinutes: item.startMinutes,
          sessionLabel: item.sessionLabel,
          teachingId: item.teachingId,
          hour: item.hour,
          teacher: item.teacher,
        });
      }
    }

    if (
      item.classeId &&
      (!teacherScope || teacherScope.classIds.includes(item.classeId))
    ) {
      const existing = classBest.get(item.classeId);
      if (
        rankWindowStart(
          item.startMinutes,
          currentMinutes,
          existing?.startMinutes ?? null,
        )
      ) {
        classBest.set(item.classeId, {
          startMinutes: item.startMinutes,
          sessionLabel: item.sessionLabel,
        });
      }
    }
  }

  const teacherIds = [...teacherBest.keys()];
  const teachingIds = [...teacherBest.values()].map((row) => row.teachingId);

  const teacherSessions =
    teachingIds.length === 0
      ? []
      : await prisma.attendanceSession.findMany({
          where: {
            date: startOfDay,
            teachingId: { in: teachingIds },
            OR: [{ branchId }, { branchId: null }],
          },
          select: { id: true, teachingId: true, startTime: true },
        });

  const sessionByTeachingHour = new Map<string, string>();
  for (const row of teacherSessions) {
    sessionByTeachingHour.set(
      `${row.teachingId}:${row.startTime.toISOString()}`,
      row.id,
    );
  }

  const matchedSessionIds = [...teacherBest.values()]
    .map((row) =>
      sessionByTeachingHour.get(`${row.teachingId}:${row.hour.toISOString()}`),
    )
    .filter((id): id is string => Boolean(id));

  const teacherAttendances =
    matchedSessionIds.length === 0
      ? []
      : await prisma.teacherAttendance.findMany({
          where: {
            branchId,
            teacherId: { in: teacherIds },
            sessionId: { in: matchedSessionIds },
          },
          select: {
            id: true,
            teacherId: true,
            sessionId: true,
            checkIn: true,
            checkOut: true,
            earlyExit: true,
          },
        });

  const attendanceByTeacher = new Map(
    teacherAttendances.map((row) => [row.teacherId, row]),
  );

  const teachers = [...teacherBest.entries()]
    .sort((a, b) => a[1].startMinutes - b[1].startMinutes)
    .map(([teacherId, row]) => {
      const state = attendanceOpenState(attendanceByTeacher.get(teacherId));
      return {
        ...mapTeacherLookup(row.teacher),
        expectedSessionLabel: row.sessionLabel,
        ...state,
      };
    });

  const classWhere = {
    branchId,
    OR: [{ statusClasse: true }, { statusClasse: null }],
    ...(teacherScope
      ? { id: { in: teacherScope.classIds.length ? teacherScope.classIds : ["__none__"] } }
      : {}),
  };

  const classes = await prisma.classe.findMany({
    where: classWhere,
    select: {
      id: true,
      nameClasse: true,
      codeClasse: true,
      level: true,
      cycle: true,
      parallel: true,
      _count: {
        select: {
          classEnrollment: {
            where: {
              branchId,
              schoolYear: { isCurrentYear: true, branchId },
              OR: [{ statusEnrollment: true }, { statusEnrollment: null }],
            },
          },
        },
      },
    },
  });

  const sortedClasses = [...classes].sort(compareClassesByLevel);

  const classRows: AttendanceCheckInClass[] = sortedClasses.map((classe) => {
    const upcoming = classBest.get(classe.id);
    return {
      id: classe.id,
      name: classe.nameClasse,
      code: classe.codeClasse,
      level: classe.level,
      cycle: classe.cycle,
      studentCount: classe._count.classEnrollment,
      hasUpcomingSession: Boolean(upcoming),
      expectedSessionLabel: upcoming?.sessionLabel ?? null,
    };
  });

  const cycleMap = new Map<string, AttendanceCheckInCycleGroup>();

  for (const classe of classRows) {
    const cycleKey = isCycle(classe.cycle) ? classe.cycle : "AUTRE";
    const levelKey = classe.level?.trim() || "__none__";
    const groupKey = `${cycleKey}::${levelKey}`;

    let cycleGroup = cycleMap.get(cycleKey);
    if (!cycleGroup) {
      cycleGroup = {
        key: cycleKey,
        label: isCycle(cycleKey) ? cycleLabel(cycleKey as Cycle) : "Autres",
        levels: [],
      };
      cycleMap.set(cycleKey, cycleGroup);
    }

    let level = cycleGroup.levels.find((item) => item.key === groupKey);
    if (!level) {
      const levelLabel = classe.level?.trim() || "Autres";
      level = {
        key: groupKey,
        label: levelLabel,
        cycle: classe.cycle,
        level: classe.level,
        classes: [],
      };
      cycleGroup.levels.push(level);
    }
    level.classes.push(classe);
  }

  const cycles = [...cycleMap.values()].sort((left, right) => {
    const leftOrder =
      CYCLE_SORT_ORDER[left.key as Cycle] ?? Number.MAX_SAFE_INTEGER;
    const rightOrder =
      CYCLE_SORT_ORDER[right.key as Cycle] ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });

  for (const cycle of cycles) {
    cycle.levels.sort((left, right) =>
      compareClassesByLevel(
        {
          cycle: left.cycle,
          level: left.level,
          nameClasse: left.classes[0]?.name,
        },
        {
          cycle: right.cycle,
          level: right.level,
          nameClasse: right.classes[0]?.name,
        },
      ),
    );
    for (const level of cycle.levels) {
      level.classes.sort((left, right) => {
        if (left.hasUpcomingSession !== right.hasUpcomingSession) {
          return left.hasUpcomingSession ? -1 : 1;
        }
        return compareClassesByLevel(
          {
            cycle: left.cycle,
            level: left.level,
            nameClasse: left.name,
            codeClasse: left.code,
          },
          {
            cycle: right.cycle,
            level: right.level,
            nameClasse: right.name,
            codeClasse: right.code,
          },
        );
      });
    }
  }

  return {
    teachers,
    cycles,
    canViewPersonnel: !teacherScope,
  };
}

export async function listStudentsForClassCheckInAction(
  classeId: string,
): Promise<AttendancePersonLookup[]> {
  const { branchId, session, userId } =
    await requireBranchContext();
  const { classeId: parsedClasseId } = z
    .object({ classeId: z.string().min(1) })
    .parse({ classeId });

  const teacherScope = await getTeacherAttendanceReadScope({
    session,
    userId,
    branchId,
  });
  if (teacherScope && !teacherScope.classIds.includes(parsedClasseId)) {
    return [];
  }

  const classe = await prisma.classe.findFirst({
    where: { id: parsedClasseId, branchId },
    select: { id: true, nameClasse: true, codeClasse: true },
  });
  if (!classe) return [];

  const enrollments = await prisma.classEnrollment.findMany({
    where: {
      classeId: parsedClasseId,
      branchId,
      schoolYear: { isCurrentYear: true, branchId },
      OR: [{ statusEnrollment: true }, { statusEnrollment: null }],
    },
    include: {
      student: {
        include: {
          branchMember: {
            include: {
              member: { include: { user: true } },
            },
          },
        },
      },
    },
  });

  const candidates = await listClassScheduleCandidates(
    parsedClasseId,
    branchId,
  );
  const best = candidates[0];
  let sessionLabel: string | null = null;
  let sessionId: string | null = null;

  if (best) {
    const schedule = await prisma.schedule.findFirst({
      where: { id: best.scheduleId },
      include: {
        teaching: {
          include: {
            cours: { select: { nameCours: true } },
            classe: { select: { codeClasse: true, nameClasse: true } },
          },
        },
      },
    });
    if (schedule?.hour && schedule.teaching) {
      sessionLabel = formatExpectedSessionLabel(schedule.hour, schedule.teaching);
      const existingSession = await prisma.attendanceSession.findFirst({
        where: {
          teachingId: best.teachingId,
          date: startOfTodayParis(),
          startTime: schedule.hour,
          OR: [{ branchId }, { branchId: null }],
        },
        select: { id: true },
      });
      sessionId = existingSession?.id ?? null;
    }
  }

  const studentIds = enrollments
    .map((row) => row.student?.id)
    .filter((id): id is string => Boolean(id));

  const attendances =
    sessionId && studentIds.length
      ? await prisma.studentAttendance.findMany({
          where: {
            branchId,
            sessionId,
            studentId: { in: studentIds },
          },
          select: {
            id: true,
            studentId: true,
            checkIn: true,
            checkOut: true,
            earlyExit: true,
          },
        })
      : [];

  const attendanceByStudent = new Map(
    attendances.map((row) => [row.studentId, row]),
  );

  const classLabel = classe.nameClasse || classe.codeClasse;

  return enrollments
    .flatMap((row) => {
      const student = row.student;
      if (!student) return [];
      const user = student.branchMember?.member?.user;
      const state = attendanceOpenState(attendanceByStudent.get(student.id));
      return [
        {
          id: student.id,
          name: user ? getPersonName(user) : "Eleve",
          matricule: user?.username ?? student.id.slice(-8).toUpperCase(),
          roleLabel: classLabel,
          personType: "student" as const,
          image: user?.image ?? null,
          expectedSessionLabel: sessionLabel,
          classeId: parsedClasseId,
          ...state,
        },
      ];
    })
    .sort((left, right) => left.name.localeCompare(right.name, "fr"));
}

export async function listPersonnelForCheckInAction(): Promise<
  AttendancePersonLookup[]
> {
  const { branchId, organizationId, session, userId } =
    await requireBranchContext();
  const teacherScope = await getTeacherAttendanceReadScope({
    session,
    userId,
    branchId,
  });
  if (teacherScope) return [];

  const today = startOfTodayParis();
  const personnels = await prisma.personnel.findMany({
    where: {
      branchMember: { branchId, branch: { organizationId } },
    },
    include: userInclude(),
    orderBy: { createdAt: "desc" },
    take: 80,
  });

  const attendances = await prisma.personnelAttendance.findMany({
    where: {
      branchId,
      date: today,
      personnelId: { in: personnels.map((row) => row.id) },
    },
    select: {
      id: true,
      personnelId: true,
      checkIn: true,
      checkOut: true,
      earlyExit: true,
    },
  });

  const attendanceByPersonnel = new Map(
    attendances.map((row) => [row.personnelId, row]),
  );

  return personnels
    .map((personnel) => ({
      ...mapPersonnelLookup(personnel),
      ...attendanceOpenState(attendanceByPersonnel.get(personnel.id)),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "fr"));
}
