import { prisma } from "@/lib/prisma";
import { getBranchAbsenceReviewers } from "@/lib/email/get-branch-manager-emails";
import { sendAbsenceLifecycleEmail } from "@/lib/email/send-absence-notification-email";
import {
  ensureAttendanceSessionForSchedule,
  getBranchCourseDurationMinutes,
} from "@/lib/attendance-teacher-session";
import { formatExpectedSessionLabel } from "@/lib/attendance-schedule-label";
import { isBranchClosedOn } from "@/lib/branch-closed-days";
import {
  getParisWeekday,
  nowLocal,
  scheduleHourToMinutes,
  startOfTodayParis,
  toMinutes,
} from "@/lib/timezone";
import { Day } from "@/prisma/generated/prisma/client";
import type {
  AbsenceCase,
  AbsenceCaseStatus,
  AppNotificationType,
  AttendanceStatus,
  AttendanceSubjectType,
} from "@/prisma/generated/prisma/client";

export const ABSENCE_GRACE_MINUTES = 15;
const DASHBOARD_SIGNAL_INTERVAL_MS = 2 * 60 * 1000;
const lastSignalByBranch = new Map<string, number>();

const DAY_BY_WEEKDAY = {
  0: Day.Dimanche,
  1: Day.Lundi,
  2: Day.Mardi,
  3: Day.Mercredi,
  4: Day.Jeudi,
  5: Day.Vendredi,
  6: Day.Samedi,
} as const;

const userContactSelect = {
  id: true,
  email: true,
  telephone: true,
  name: true,
  prenom: true,
  postnom: true,
} as const;

type UserContact = {
  id: string;
  email: string | null;
  telephone: string | null;
  name: string;
  prenom: string | null;
  postnom: string | null;
};

export type AbsenceCaseView = {
  id: string;
  status: AbsenceCaseStatus;
  subjectType: AttendanceSubjectType;
  contextLabel: string;
  occurredOn: string;
  personName: string;
  justification: string | null;
  reviewComment: string | null;
  justifiedAt: string | null;
  reviewedAt: string | null;
};

function formatPersonName(user: UserContact | null | undefined) {
  if (!user) return "Utilisateur";
  return (
    [user.prenom, user.name, user.postnom].filter(Boolean).join(" ").trim() ||
    user.name ||
    "Utilisateur"
  );
}

function subjectLabel(type: AttendanceSubjectType) {
  if (type === "TEACHER") return "Enseignant";
  if (type === "PERSONNEL") return "Personnel";
  return "Élève";
}

function isPresentLike(status: AttendanceStatus, checkIn?: Date | null) {
  return status === "PRESENT" || status === "LATE" || Boolean(checkIn);
}

async function getBranchContact(branchId: string) {
  return prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true, name: true, organizationId: true },
  });
}

async function createAppNotification(input: {
  branchId: string;
  userId: string;
  type: AppNotificationType;
  title: string;
  body: string;
  absenceCaseId: string;
}) {
  return prisma.appNotification.create({
    data: input,
  });
}

async function markRelatedNotificationsRead(params: {
  absenceCaseId: string;
  userId: string;
  types?: AppNotificationType[];
}) {
  await prisma.appNotification.updateMany({
    where: {
      absenceCaseId: params.absenceCaseId,
      userId: params.userId,
      readAt: null,
      ...(params.types ? { type: { in: params.types } } : {}),
    },
    data: { readAt: nowLocal() },
  });
}

async function notifyAbsenceOpened(params: {
  caseRow: AbsenceCase;
  user: UserContact;
  branchName: string;
}) {
  const personName = formatPersonName(params.user);
  await createAppNotification({
    branchId: params.caseRow.branchId,
    userId: params.user.id,
    type: "ABSENCE",
    title: "Absence signalée",
    body: `${params.caseRow.contextLabel} — cliquez pour justifier.`,
    absenceCaseId: params.caseRow.id,
  });

  void sendAbsenceLifecycleEmail({
    kind: "absence",
    to: params.user.email,
    phone: params.user.telephone,
    recipientName: personName,
    personName,
    branchName: params.branchName,
    contextLabel: params.caseRow.contextLabel,
    occurredOn: params.caseRow.occurredOn,
    subjectLabel: subjectLabel(params.caseRow.subjectType),
    organizationId: params.caseRow.organizationId,
  });
}

async function notifyJustificationToReviewers(params: {
  caseRow: AbsenceCase;
  personName: string;
  branchName: string;
  organizationId: string;
}) {
  const reviewers = await getBranchAbsenceReviewers({
    branchId: params.caseRow.branchId,
    organizationId: params.organizationId,
  });

  await Promise.all(
    reviewers.map(async (reviewer) => {
      await createAppNotification({
        branchId: params.caseRow.branchId,
        userId: reviewer.userId,
        type: "JUSTIFICATION_SUBMITTED",
        title: "Justification d'absence à examiner",
        body: `${params.personName} · ${params.caseRow.contextLabel}`,
        absenceCaseId: params.caseRow.id,
      });
      void sendAbsenceLifecycleEmail({
        kind: "justification_received",
        to: reviewer.email,
        phone: reviewer.telephone,
        recipientName: reviewer.name,
        personName: params.personName,
        branchName: params.branchName,
        contextLabel: params.caseRow.contextLabel,
        occurredOn: params.caseRow.occurredOn,
        subjectLabel: subjectLabel(params.caseRow.subjectType),
        justification: params.caseRow.justification,
        organizationId: params.organizationId,
      });
    }),
  );
}

async function openAbsenceCase(input: {
  branchId: string;
  organizationId: string;
  user: UserContact;
  subjectType: AttendanceSubjectType;
  sourceKey: string;
  occurredOn: Date;
  contextLabel: string;
  studentId?: string;
  teacherId?: string;
  personnelId?: string;
  sessionId?: string;
  studentAttendanceId?: string;
  teacherAttendanceId?: string;
  personnelAttendanceId?: string;
}) {
  const existing = await prisma.absenceCase.findUnique({
    where: {
      branchId_sourceKey: {
        branchId: input.branchId,
        sourceKey: input.sourceKey,
      },
    },
  });

  if (existing) {
    if (existing.status === "CLEARED" || existing.status === "ACCEPTED") {
      return existing;
    }
    if (!existing.absenceNotifiedAt) {
      const branch = await getBranchContact(input.branchId);
      if (branch) {
        await notifyAbsenceOpened({
          caseRow: existing,
          user: input.user,
          branchName: branch.name,
        });
        return prisma.absenceCase.update({
          where: { id: existing.id },
          data: { absenceNotifiedAt: nowLocal() },
        });
      }
    }
    return existing;
  }

  try {
    const created = await prisma.absenceCase.create({
      data: {
        branchId: input.branchId,
        organizationId: input.organizationId,
        userId: input.user.id,
        subjectType: input.subjectType,
        sourceKey: input.sourceKey,
        occurredOn: input.occurredOn,
        contextLabel: input.contextLabel,
        studentId: input.studentId,
        teacherId: input.teacherId,
        personnelId: input.personnelId,
        sessionId: input.sessionId,
        studentAttendanceId: input.studentAttendanceId,
        teacherAttendanceId: input.teacherAttendanceId,
        personnelAttendanceId: input.personnelAttendanceId,
        absenceNotifiedAt: nowLocal(),
      },
    });

    const branch = await getBranchContact(input.branchId);
    if (branch) {
      await notifyAbsenceOpened({
        caseRow: created,
        user: input.user,
        branchName: branch.name,
      });
    }
    return created;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "P2002") {
      return prisma.absenceCase.findUnique({
        where: {
          branchId_sourceKey: {
            branchId: input.branchId,
            sourceKey: input.sourceKey,
          },
        },
      });
    }
    throw error;
  }
}

export async function resolveAbsenceIfPresent(params: {
  branchId: string;
  sourceKey: string;
}) {
  const existing = await prisma.absenceCase.findUnique({
    where: {
      branchId_sourceKey: {
        branchId: params.branchId,
        sourceKey: params.sourceKey,
      },
    },
  });

  if (!existing) return null;
  if (
    existing.status === "ACCEPTED" ||
    existing.status === "CLEARED" ||
    existing.status === "REJECTED"
  ) {
    return existing;
  }

  return prisma.absenceCase.update({
    where: { id: existing.id },
    data: {
      status: "CLEARED",
      reviewedAt: nowLocal(),
    },
  });
}

export async function syncStudentAttendanceAbsence(params: {
  branchId: string;
  organizationId: string;
  studentId: string;
  sessionId: string;
  attendanceId: string;
  status: AttendanceStatus;
  checkIn?: Date | null;
  contextLabel: string;
  occurredOn: Date;
  user: UserContact;
}) {
  const sourceKey = `student:${params.sessionId}:${params.studentId}`;
  if (isPresentLike(params.status, params.checkIn) || params.status === "EXCUSED") {
    return resolveAbsenceIfPresent({ branchId: params.branchId, sourceKey });
  }
  if (params.status !== "ABSENT") return null;

  return openAbsenceCase({
    branchId: params.branchId,
    organizationId: params.organizationId,
    user: params.user,
    subjectType: "STUDENT",
    sourceKey,
    occurredOn: params.occurredOn,
    contextLabel: params.contextLabel,
    studentId: params.studentId,
    sessionId: params.sessionId,
    studentAttendanceId: params.attendanceId,
  });
}

export async function syncTeacherAttendanceAbsence(params: {
  branchId: string;
  organizationId: string;
  teacherId: string;
  sessionId: string;
  attendanceId: string;
  status: AttendanceStatus;
  checkIn?: Date | null;
  contextLabel: string;
  occurredOn: Date;
  user: UserContact;
}) {
  const sourceKey = `teacher:${params.sessionId}:${params.teacherId}`;
  if (isPresentLike(params.status, params.checkIn) || params.status === "EXCUSED") {
    return resolveAbsenceIfPresent({ branchId: params.branchId, sourceKey });
  }
  if (params.status !== "ABSENT") return null;

  return openAbsenceCase({
    branchId: params.branchId,
    organizationId: params.organizationId,
    user: params.user,
    subjectType: "TEACHER",
    sourceKey,
    occurredOn: params.occurredOn,
    contextLabel: params.contextLabel,
    teacherId: params.teacherId,
    sessionId: params.sessionId,
    teacherAttendanceId: params.attendanceId,
  });
}

export async function syncPersonnelAttendanceAbsence(params: {
  branchId: string;
  organizationId: string;
  personnelId: string;
  attendanceId: string;
  date: Date;
  status: AttendanceStatus;
  checkIn?: Date | null;
  user: UserContact;
}) {
  const dayKey = startOfTodayParis(params.date).toISOString().slice(0, 10);
  const sourceKey = `personnel:${dayKey}:${params.personnelId}`;
  if (isPresentLike(params.status, params.checkIn) || params.status === "EXCUSED") {
    return resolveAbsenceIfPresent({ branchId: params.branchId, sourceKey });
  }
  if (params.status !== "ABSENT") return null;

  return openAbsenceCase({
    branchId: params.branchId,
    organizationId: params.organizationId,
    user: params.user,
    subjectType: "PERSONNEL",
    sourceKey,
    occurredOn: startOfTodayParis(params.date),
    contextLabel: "Présence journalière",
    personnelId: params.personnelId,
    personnelAttendanceId: params.attendanceId,
  });
}

async function loadStudentUser(studentId: string, branchId: string) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, branchMember: { branchId } },
    select: {
      id: true,
      branchMember: {
        select: {
          member: { select: { user: { select: userContactSelect } } },
        },
      },
    },
  });
  return student?.branchMember?.member?.user ?? null;
}

async function loadTeacherUser(teacherId: string, branchId: string) {
  const teacher = await prisma.teacher.findFirst({
    where: { id: teacherId, branchMember: { branchId } },
    select: {
      id: true,
      branchMember: {
        select: {
          member: { select: { user: { select: userContactSelect } } },
        },
      },
    },
  });
  return teacher?.branchMember?.member?.user ?? null;
}

async function loadPersonnelUser(personnelId: string, branchId: string) {
  const personnel = await prisma.personnel.findFirst({
    where: { id: personnelId, branchMember: { branchId } },
    select: {
      id: true,
      branchMember: {
        select: {
          member: { select: { user: { select: userContactSelect } } },
        },
      },
    },
  });
  return personnel?.branchMember?.member?.user ?? null;
}

async function signalEndedSessionAbsences(branchId: string) {
  const now = nowLocal();
  const today = startOfTodayParis(now);
  const currentMinutes = toMinutes(now);
  const weekday = getParisWeekday(now);
  const day = DAY_BY_WEEKDAY[weekday as keyof typeof DAY_BY_WEEKDAY];
  const courseDurationMinutes = await getBranchCourseDurationMinutes(branchId);
  const branch = await getBranchContact(branchId);
  if (!branch) return 0;

  const schedules = await prisma.schedule.findMany({
    where: {
      day,
      isArchived: false,
      teaching: {
        OR: [{ branchId }, { branchId: null, classe: { branchId } }],
        schoolYear: { branchId, isCurrentYear: true },
      },
    },
    include: {
      teaching: {
        include: {
          cours: { select: { nameCours: true } },
          classe: { select: { id: true, codeClasse: true, nameClasse: true } },
        },
      },
    },
  });

  let created = 0;

  for (const schedule of schedules) {
    if (!schedule.teachingId || !schedule.hour || !schedule.teaching) continue;
    const startMinutes = scheduleHourToMinutes(schedule.hour);
    const endMinutes = startMinutes + courseDurationMinutes;
    if (currentMinutes <= endMinutes + ABSENCE_GRACE_MINUTES) continue;

    const session = await ensureAttendanceSessionForSchedule(
      schedule.teachingId,
      schedule.id,
      branchId,
      courseDurationMinutes,
      { requireCheckInWindow: false },
    );
    if (!session) continue;

    const contextLabel = formatExpectedSessionLabel(
      schedule.hour,
      schedule.teaching,
    );

    const teacherId = schedule.teaching.teacherId;
    if (teacherId) {
      const existingTeacher = await prisma.teacherAttendance.findUnique({
        where: {
          teacherId_sessionId_branchId: {
            teacherId,
            sessionId: session.id,
            branchId,
          },
        },
      });

      if (
        !existingTeacher ||
        (existingTeacher.status === "ABSENT" && !existingTeacher.checkIn)
      ) {
        const attendance =
          existingTeacher ??
          (await prisma.teacherAttendance.create({
            data: {
              teacherId,
              sessionId: session.id,
              status: "ABSENT",
              date: today,
              branchId,
            },
          }));
        const user = await loadTeacherUser(teacherId, branchId);
        if (user) {
          await syncTeacherAttendanceAbsence({
            branchId,
            organizationId: branch.organizationId,
            teacherId,
            sessionId: session.id,
            attendanceId: attendance.id,
            status: "ABSENT",
            contextLabel,
            occurredOn: today,
            user,
          });
          created += 1;
        }
      }
    }

    const classeId = schedule.teaching.classeId;
    if (!classeId) continue;

    const enrollments = await prisma.classEnrollment.findMany({
      where: {
        classeId,
        branchId,
        statusEnrollment: { not: false },
        schoolYear: { branchId, isCurrentYear: true },
      },
      select: {
        studentId: true,
        student: {
          select: {
            branchMember: {
              select: {
                member: { select: { user: { select: userContactSelect } } },
              },
            },
          },
        },
      },
    });

    const existingStudentRows = await prisma.studentAttendance.findMany({
      where: { sessionId: session.id, branchId },
      select: { studentId: true, status: true, checkIn: true, id: true },
    });
    const byStudentId = new Map(
      existingStudentRows.map((row) => [row.studentId, row]),
    );

    for (const enrollment of enrollments) {
      const existing = byStudentId.get(enrollment.studentId);
      if (existing && isPresentLike(existing.status, existing.checkIn)) continue;
      if (existing?.status === "EXCUSED") continue;

      const attendance =
        existing ??
        (await prisma.studentAttendance.create({
          data: {
            studentId: enrollment.studentId,
            sessionId: session.id,
            status: "ABSENT",
            branchId,
          },
        }));

      const user = enrollment.student?.branchMember?.member?.user;
      if (!user) continue;

      await syncStudentAttendanceAbsence({
        branchId,
        organizationId: branch.organizationId,
        studentId: enrollment.studentId,
        sessionId: session.id,
        attendanceId: attendance.id,
        status: "ABSENT",
        contextLabel,
        occurredOn: today,
        user,
      });
      created += 1;
    }
  }

  return created;
}

async function signalPersonnelDayAbsences(branchId: string) {
  const now = nowLocal();
  if (getParisWeekday(now) === 0) return 0;

  const currentMinutes = toMinutes(now);
  const creneaux = await prisma.creneau.findMany({
    where: { branchId, isArchived: false },
    select: { endTime: true },
  });
  const lastEnd =
    creneaux.length > 0
      ? Math.max(...creneaux.map((row) => scheduleHourToMinutes(row.endTime)))
      : 16 * 60;
  if (currentMinutes <= lastEnd + ABSENCE_GRACE_MINUTES) return 0;

  const branch = await getBranchContact(branchId);
  if (!branch) return 0;

  const today = startOfTodayParis(now);
  const personnelRows = await prisma.personnel.findMany({
    where: {
      branchMember: {
        branchId,
        member: { isArchived: false, organizationId: branch.organizationId },
      },
    },
    select: {
      id: true,
      branchMember: {
        select: {
          member: { select: { user: { select: userContactSelect } } },
        },
      },
    },
  });

  let created = 0;
  for (const row of personnelRows) {
    const existing = await prisma.personnelAttendance.findUnique({
      where: {
        personnelId_date_branchId: {
          personnelId: row.id,
          date: today,
          branchId,
        },
      },
    });
    if (existing && isPresentLike(existing.status, existing.checkIn)) continue;
    if (existing?.status === "EXCUSED") continue;

    const attendance =
      existing ??
      (await prisma.personnelAttendance.create({
        data: {
          personnelId: row.id,
          date: today,
          status: "ABSENT",
          branchId,
        },
      }));

    const user = row.branchMember?.member?.user;
    if (!user) continue;

    await syncPersonnelAttendanceAbsence({
      branchId,
      organizationId: branch.organizationId,
      personnelId: row.id,
      attendanceId: attendance.id,
      date: today,
      status: "ABSENT",
      user,
    });
    created += 1;
  }

  return created;
}

export async function signalEndedAbsencesForBranch(branchId: string) {
  if (await isBranchClosedOn(branchId)) {
    return { created: 0 };
  }
  const [sessions, personnel] = await Promise.all([
    signalEndedSessionAbsences(branchId),
    signalPersonnelDayAbsences(branchId),
  ]);
  return { created: sessions + personnel };
}

export async function signalEndedAbsencesForBranchDebounced(branchId: string) {
  const last = lastSignalByBranch.get(branchId) ?? 0;
  if (Date.now() - last < DASHBOARD_SIGNAL_INTERVAL_MS) {
    return { created: 0, skipped: true as const };
  }
  lastSignalByBranch.set(branchId, Date.now());
  const result = await signalEndedAbsencesForBranch(branchId);
  return { ...result, skipped: false as const };
}

export async function signalEndedAbsencesForAllBranches() {
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  let created = 0;
  for (const branch of branches) {
    const result = await signalEndedAbsencesForBranch(branch.id);
    created += result.created;
  }
  return { created, branches: branches.length };
}

export async function submitAbsenceJustification(params: {
  caseId: string;
  userId: string;
  branchId: string;
  justification: string;
}) {
  const text = params.justification.trim();
  if (text.length < 8) {
    throw new Error("Expliquez le motif de l'absence (au moins 8 caractères).");
  }

  const caseRow = await prisma.absenceCase.findFirst({
    where: {
      id: params.caseId,
      branchId: params.branchId,
      userId: params.userId,
    },
    include: {
      user: { select: userContactSelect },
      branch: { select: { name: true, organizationId: true } },
    },
  });

  if (!caseRow) throw new Error("Absence introuvable.");
  if (caseRow.status !== "OPEN" && caseRow.status !== "REJECTED") {
    throw new Error("Cette absence n'attend plus de justification.");
  }

  const updated = await prisma.absenceCase.update({
    where: { id: caseRow.id },
    data: {
      status: "PENDING_REVIEW",
      justification: text,
      justifiedAt: nowLocal(),
    },
    include: {
      user: { select: userContactSelect },
      branch: { select: { name: true, organizationId: true } },
    },
  });

  if (updated.studentAttendanceId) {
    await prisma.studentAttendance.update({
      where: { id: updated.studentAttendanceId },
      data: { justification: text },
    });
  }

  await markRelatedNotificationsRead({
    absenceCaseId: updated.id,
    userId: params.userId,
    types: ["ABSENCE", "JUSTIFICATION_DECISION"],
  });

  const personName = formatPersonName(updated.user);
  await createAppNotification({
    branchId: updated.branchId,
    userId: params.userId,
    type: "JUSTIFICATION_SUBMITTED",
    title: "Justification envoyée",
    body: `${updated.contextLabel} — en attente de décision.`,
    absenceCaseId: updated.id,
  });

  void sendAbsenceLifecycleEmail({
    kind: "justification_submitted",
    to: updated.user.email,
    phone: updated.user.telephone,
    recipientName: personName,
    personName,
    branchName: updated.branch.name,
    contextLabel: updated.contextLabel,
    occurredOn: updated.occurredOn,
    subjectLabel: subjectLabel(updated.subjectType),
    justification: text,
    organizationId: updated.branch.organizationId,
  });

  await notifyJustificationToReviewers({
    caseRow: updated,
    personName,
    branchName: updated.branch.name,
    organizationId: updated.branch.organizationId,
  });

  return updated;
}

export async function reviewAbsenceJustification(params: {
  caseId: string;
  branchId: string;
  reviewerId: string;
  decision: "ACCEPTED" | "REJECTED";
  comment?: string;
}) {
  const caseRow = await prisma.absenceCase.findFirst({
    where: { id: params.caseId, branchId: params.branchId },
    include: {
      user: { select: userContactSelect },
      branch: { select: { name: true, organizationId: true } },
    },
  });

  if (!caseRow) throw new Error("Dossier d'absence introuvable.");
  if (caseRow.status !== "PENDING_REVIEW") {
    throw new Error("Cette justification a déjà été traitée.");
  }

  const comment = params.comment?.trim() || null;
  const updated = await prisma.absenceCase.update({
    where: { id: caseRow.id },
    data: {
      status: params.decision,
      reviewComment: comment,
      reviewedById: params.reviewerId,
      reviewedAt: nowLocal(),
      returnNotifiedAt:
        params.decision === "ACCEPTED" ? nowLocal() : caseRow.returnNotifiedAt,
    },
    include: {
      user: { select: userContactSelect },
      branch: { select: { name: true, organizationId: true } },
    },
  });

  if (params.decision === "ACCEPTED") {
    if (updated.studentAttendanceId) {
      await prisma.studentAttendance.update({
        where: { id: updated.studentAttendanceId },
        data: { status: "EXCUSED", justification: updated.justification },
      });
    }
    if (updated.teacherAttendanceId) {
      await prisma.teacherAttendance.update({
        where: { id: updated.teacherAttendanceId },
        data: { status: "EXCUSED" },
      });
    }
    if (updated.personnelAttendanceId) {
      await prisma.personnelAttendance.update({
        where: { id: updated.personnelAttendanceId },
        data: { status: "EXCUSED" },
      });
    }
  }

  await prisma.appNotification.updateMany({
    where: {
      absenceCaseId: updated.id,
      type: "JUSTIFICATION_SUBMITTED",
      readAt: null,
    },
    data: { readAt: nowLocal() },
  });

  const personName = formatPersonName(updated.user);
  const accepted = params.decision === "ACCEPTED";

  await createAppNotification({
    branchId: updated.branchId,
    userId: updated.userId,
    type: "JUSTIFICATION_DECISION",
    title: accepted
      ? "Justification acceptée"
      : "Justification refusée",
    body: accepted
      ? `${updated.contextLabel} — un retour a été signalé dans votre compte.`
      : `${updated.contextLabel}${comment ? ` — ${comment}` : ""}`,
    absenceCaseId: updated.id,
  });

  void sendAbsenceLifecycleEmail({
    kind: accepted ? "accepted" : "rejected",
    to: updated.user.email,
    phone: updated.user.telephone,
    recipientName: personName,
    personName,
    branchName: updated.branch.name,
    contextLabel: updated.contextLabel,
    occurredOn: updated.occurredOn,
    subjectLabel: subjectLabel(updated.subjectType),
    justification: updated.justification,
    reviewComment: comment,
    organizationId: updated.branch.organizationId,
  });

  if (accepted) {
    await createAppNotification({
      branchId: updated.branchId,
      userId: updated.userId,
      type: "RETURN",
      title: "Retour signalé",
      body: `Retour enregistré après absence · ${updated.contextLabel}`,
      absenceCaseId: updated.id,
    });
    void sendAbsenceLifecycleEmail({
      kind: "return",
      to: updated.user.email,
      phone: updated.user.telephone,
      recipientName: personName,
      personName,
      branchName: updated.branch.name,
      contextLabel: updated.contextLabel,
      occurredOn: updated.occurredOn,
      subjectLabel: subjectLabel(updated.subjectType),
      organizationId: updated.branch.organizationId,
    });
  }

  return updated;
}

function toView(
  row: AbsenceCase & { user?: UserContact | null },
): AbsenceCaseView {
  return {
    id: row.id,
    status: row.status,
    subjectType: row.subjectType,
    contextLabel: row.contextLabel,
    occurredOn: row.occurredOn.toISOString(),
    personName: formatPersonName(row.user),
    justification: row.justification,
    reviewComment: row.reviewComment,
    justifiedAt: row.justifiedAt?.toISOString() ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  };
}

export async function listMyAbsenceCases(params: {
  branchId: string;
  userId: string;
}): Promise<AbsenceCaseView[]> {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const rows = await prisma.absenceCase.findMany({
    where: {
      branchId: params.branchId,
      userId: params.userId,
      OR: [
        { status: { in: ["OPEN", "PENDING_REVIEW"] } },
        { status: { in: ["ACCEPTED", "REJECTED"] }, reviewedAt: { gte: since } },
      ],
    },
    include: { user: { select: userContactSelect } },
    orderBy: { occurredOn: "desc" },
    take: 20,
  });
  return rows.map(toView);
}

export async function listPendingAbsenceReviews(params: {
  branchId: string;
}): Promise<AbsenceCaseView[]> {
  const rows = await prisma.absenceCase.findMany({
    where: { branchId: params.branchId, status: "PENDING_REVIEW" },
    include: { user: { select: userContactSelect } },
    orderBy: { justifiedAt: "desc" },
    take: 30,
  });
  return rows.map(toView);
}

export async function getAbsenceCaseForUser(params: {
  caseId: string;
  branchId: string;
  userId: string;
  asReviewer: boolean;
}): Promise<AbsenceCaseView | null> {
  const row = await prisma.absenceCase.findFirst({
    where: {
      id: params.caseId,
      branchId: params.branchId,
      ...(params.asReviewer ? {} : { userId: params.userId }),
    },
    include: { user: { select: userContactSelect } },
  });
  return row ? toView(row) : null;
}

export async function listUnreadAppNotifications(params: {
  branchId: string;
  userId: string;
}) {
  const rows = await prisma.appNotification.findMany({
    where: {
      branchId: params.branchId,
      userId: params.userId,
      readAt: null,
    },
    include: {
      absenceCase: {
        include: { user: { select: userContactSelect } },
      },
      gradeModificationRequest: {
        select: {
          id: true,
          status: true,
          contextLabel: true,
          justification: true,
          evidenceUrl: true,
          reviewComment: true,
          requestedById: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  // L'enseignant ne voit pas sa propre « demande envoyée », seulement la décision.
  return rows.filter((row) => {
    if (row.type !== "GRADE_MODIFICATION_SUBMITTED") return true;
    return row.gradeModificationRequest?.requestedById !== params.userId;
  }).slice(0, 30);
}

export async function countUnreadAppNotifications(params: {
  branchId: string;
  userId: string;
}) {
  const rows = await prisma.appNotification.findMany({
    where: {
      branchId: params.branchId,
      userId: params.userId,
      readAt: null,
    },
    select: {
      type: true,
      gradeModificationRequest: { select: { requestedById: true } },
    },
  });
  return rows.filter((row) => {
    if (row.type !== "GRADE_MODIFICATION_SUBMITTED") return true;
    return row.gradeModificationRequest?.requestedById !== params.userId;
  }).length;
}

export async function markAppNotificationRead(params: {
  notificationId: string;
  userId: string;
  branchId: string;
}) {
  return prisma.appNotification.updateMany({
    where: {
      id: params.notificationId,
      userId: params.userId,
      branchId: params.branchId,
      readAt: null,
    },
    data: { readAt: nowLocal() },
  });
}

async function sessionContextLabel(sessionId: string, branchId: string) {
  const session = await prisma.attendanceSession.findFirst({
    where: { id: sessionId, branchId },
    include: {
      teaching: {
        include: {
          cours: { select: { nameCours: true } },
          classe: { select: { codeClasse: true, nameClasse: true } },
        },
      },
    },
  });
  if (!session) return "Séance";
  return formatExpectedSessionLabel(session.startTime, session.teaching);
}

export async function afterStudentAttendanceWrite(params: {
  branchId: string;
  organizationId: string;
  studentId: string;
  sessionId: string;
  attendanceId: string;
  status: AttendanceStatus;
  checkIn?: Date | null;
}) {
  const [user, contextLabel] = await Promise.all([
    loadStudentUser(params.studentId, params.branchId),
    sessionContextLabel(params.sessionId, params.branchId),
  ]);
  if (!user) return null;
  return syncStudentAttendanceAbsence({
    ...params,
    contextLabel,
    occurredOn: startOfTodayParis(),
    user,
  });
}

export async function afterTeacherAttendanceWrite(params: {
  branchId: string;
  organizationId: string;
  teacherId: string;
  sessionId: string;
  attendanceId: string;
  status: AttendanceStatus;
  checkIn?: Date | null;
}) {
  const [user, contextLabel] = await Promise.all([
    loadTeacherUser(params.teacherId, params.branchId),
    sessionContextLabel(params.sessionId, params.branchId),
  ]);
  if (!user) return null;
  return syncTeacherAttendanceAbsence({
    ...params,
    contextLabel,
    occurredOn: startOfTodayParis(),
    user,
  });
}

export async function afterPersonnelAttendanceWrite(params: {
  branchId: string;
  organizationId: string;
  personnelId: string;
  attendanceId: string;
  date: Date;
  status: AttendanceStatus;
  checkIn?: Date | null;
}) {
  const user = await loadPersonnelUser(params.personnelId, params.branchId);
  if (!user) return null;
  return syncPersonnelAttendanceAbsence({
    ...params,
    user,
  });
}
