"use server";

import { prisma } from "@/lib/prisma";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { findTeacherCheckInSession } from "@/lib/attendance-teacher-session";
import { orgRoleLabel } from "@/lib/org-role-labels";
import type { AttendanceStatus } from "@/prisma/generated/prisma/client";
import {
  nowLocal,
  scheduleHourToMinutes,
  startOfTodayParis,
  toMinutes,
} from "@/lib/timezone";
import { z } from "zod";
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

async function findSessionForStudent(studentId: string, branchId: string) {
  const now = nowLocal();
  const today = startOfTodayParis(now);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const enrollment = await prisma.classEnrollment.findFirst({
    where: {
      studentId,
      branchId,
      OR: [{ statusEnrollment: true }, { statusEnrollment: null }],
    },
    orderBy: { createdAt: "desc" },
    select: { classeId: true },
  });

  if (!enrollment) return null;

  const teachings = await prisma.teaching.findMany({
    where: {
      classeId: enrollment.classeId,
      OR: [{ branchId }, { branchId: null, classe: { branchId } }],
    },
    select: { id: true },
  });

  const teachingIds = teachings.map((item) => item.id);
  if (!teachingIds.length) return null;

  const active = await prisma.attendanceSession.findFirst({
    where: {
      branchId,
      teachingId: { in: teachingIds },
      isClosed: false,
      date: { gte: today, lt: tomorrow },
      startTime: { lte: now },
      endTime: { gte: now },
    },
    orderBy: { startTime: "asc" },
    include: sessionInclude(),
  });

  if (active) return active;

  return prisma.attendanceSession.findFirst({
    where: {
      branchId,
      teachingId: { in: teachingIds },
      date: { gte: today, lt: tomorrow },
    },
    orderBy: { startTime: "asc" },
    include: sessionInclude(),
  });
}

async function findSessionForTeacher(teacherId: string, branchId: string) {
  return findTeacherCheckInSession(teacherId, branchId, sessionInclude());
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

async function performStudentCheckIn(
  student: NonNullable<Awaited<ReturnType<typeof findStudentByScan>>>,
): Promise<AttendanceCheckInResult> {
  const { branchId } = await requireBranchContext();
  const lookup = mapStudentLookup(student);
  const session = await findSessionForStudent(student.id, branchId);

  if (!session) {
    return {
      ok: false,
      message: "Aucune session de cours disponible pour cet eleve aujourd'hui.",
      personType: "student",
      person: lookup,
    };
  }

  const status = resolveStatusFromTime(session.startTime);
  const now = nowLocal();
  const cours = session.teaching?.cours?.nameCours ?? "Cours";
  const classe =
    session.teaching?.classe?.codeClasse ??
    session.teaching?.classe?.nameClasse ??
    lookup.roleLabel;
  const sessionLabel = `${classe} • ${cours}`;

  const existingAttendance = await prisma.studentAttendance.findUnique({
    where: {
      branchId_sessionId_studentId: {
        branchId,
        sessionId: session.id,
        studentId: student.id,
      },
    },
  });

  if (existingAttendance) {
    return buildAlreadyCheckedInResult(
      lookup,
      existingAttendance.status,
      sessionLabel,
      existingAttendance.recordedAt,
    );
  }

  await prisma.studentAttendance.upsert({
    where: {
      branchId_sessionId_studentId: {
        branchId,
        sessionId: session.id,
        studentId: student.id,
      },
    },
    update: {
      status,
      recordedAt: now,
    },
    create: {
      branchId,
      sessionId: session.id,
      studentId: student.id,
      status,
      recordedAt: now,
    },
  });

  return buildSuccessResult(lookup, status, sessionLabel, now);
}

async function performTeacherCheckIn(
  teacher: NonNullable<Awaited<ReturnType<typeof findTeacherByScan>>>,
): Promise<AttendanceCheckInResult> {
  const { branchId } = await requireBranchContext();
  const lookup = mapTeacherLookup(teacher);
  const session = await findSessionForTeacher(teacher.id, branchId);

  if (!session) {
    return {
      ok: false,
      message:
        "Aucune session de cours disponible pour cet enseignant maintenant. Le pointage est ouvert a partir de 15 minutes avant le debut du cours.",
      personType: "teacher",
      person: lookup,
    };
  }

  const hydratedSession = await prisma.attendanceSession.findFirst({
    where: { id: session.id, branchId },
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

  const status = resolveStatusFromTime(hydratedSession.startTime);
  const now = nowLocal();
  const cours = hydratedSession.teaching?.cours?.nameCours ?? "Cours";
  const classe =
    hydratedSession.teaching?.classe?.codeClasse ??
    hydratedSession.teaching?.classe?.nameClasse ??
    "Classe";
  const sessionLabel = `${classe} • ${cours}`;

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
    return buildAlreadyCheckedInResult(
      lookup,
      existingAttendance.status,
      sessionLabel,
      existingAttendance.date,
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
    },
    create: {
      branchId,
      sessionId: hydratedSession.id,
      teacherId: teacher.id,
      status,
      date: now,
    },
  });

  return buildSuccessResult(lookup, status, sessionLabel, now);
}

async function performPersonnelCheckIn(
  personnel: NonNullable<Awaited<ReturnType<typeof findPersonnelByScan>>>,
): Promise<AttendanceCheckInResult> {
  const { branchId } = await requireBranchContext();
  const lookup = mapPersonnelLookup(personnel);
  const now = nowLocal();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
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

  return buildSuccessResult(lookup, status, "Presence journaliere", now);
}

export async function searchPeopleForCheckInAction(
  query: string,
): Promise<AttendancePersonLookup[]> {
  const { branchId, organizationId } = await requireBranchContext();
  const { query: search } = searchSchema.parse({ query });

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

  const [students, teachers, personnels] = await Promise.all([
    prisma.student.findMany({
      where: { branchMember: branchFilter },
      include: studentInclude(),
      take: 4,
      orderBy: { createdAt: "desc" },
    }),
    prisma.teacher.findMany({
      where: { branchMember: branchFilter },
      include: userInclude(),
      take: 4,
      orderBy: { createdAt: "desc" },
    }),
    prisma.personnel.findMany({
      where: { branchMember: branchFilter },
      include: userInclude(),
      take: 4,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return [
    ...students.map(mapStudentLookup),
    ...teachers.map(mapTeacherLookup),
    ...personnels.map(mapPersonnelLookup),
  ].slice(0, 8);
}

/** @deprecated Use searchPeopleForCheckInAction */
export async function searchStudentsForCheckInAction(query: string) {
  return searchPeopleForCheckInAction(query);
}

export async function checkInByScanAction(
  code: string,
): Promise<AttendanceCheckInResult | null> {
  const { branchId, organizationId } = await requireBranchContext();
  const { code: rawCode } = scanSchema.parse({ code });
  const parsed = parseScanCode(rawCode);

  if (!parsed) {
    return null;
  }

  const resolved = await resolvePersonFromScan(branchId, organizationId, parsed);
  if (!resolved) {
    return null;
  }

  if (resolved.type === "student") {
    return performStudentCheckIn(resolved.record);
  }

  if (resolved.type === "teacher") {
    return performTeacherCheckIn(resolved.record);
  }

  return performPersonnelCheckIn(resolved.record);
}

/** @deprecated Use checkInByScanAction */
export async function checkInStudentByScanAction(code: string) {
  return checkInByScanAction(code);
}

export async function checkInPersonByIdAction(
  personType: AttendancePersonType,
  personId: string,
): Promise<AttendanceCheckInResult> {
  const { branchId, organizationId } = await requireBranchContext();

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

    return performStudentCheckIn(student);
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

    return performTeacherCheckIn(teacher);
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

  return performPersonnelCheckIn(personnel);
}

/** @deprecated Use checkInPersonByIdAction */
export async function checkInStudentByIdAction(studentId: string) {
  return checkInPersonByIdAction("student", studentId);
}
