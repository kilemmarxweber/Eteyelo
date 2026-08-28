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
  findStudentCheckInSession,
  getExpectedStudentSessionLabel,
} from "@/lib/attendance-student-session";
import {
  findTeacherCheckInSession,
  getExpectedTeacherSessionLabel,
  listTeacherScheduleCandidates,
} from "@/lib/attendance-teacher-session";
import { ORG_ROLE } from "@/lib/permissions";
import { orgRoleLabel } from "@/lib/org-role-labels";
import type { AttendanceStatus, Prisma } from "@/prisma/generated/prisma/client";
import {
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
  AttendanceCheckInResult,
  AttendancePersonLookup,
  AttendancePersonType,
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

function resolvePersonnelStatus() {
  const now = nowLocal();
  const start = new Date(now);
  start.setHours(8, 0, 0, 0);
  return resolveStatusFromTime(start);
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

  const status = resolveStatusFromTime(hydratedSession.startTime);
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

  const now = nowLocal();
  const today = startOfTodayParis(now);
  const status = resolvePersonnelStatus();

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
