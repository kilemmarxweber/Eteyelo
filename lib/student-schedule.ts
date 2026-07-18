import { prisma } from "@/lib/prisma";
import type { StudentScheduleData, StudentScheduleEntry } from "@/lib/student-schedule-types";
import { genererCreneaux } from "@/src/hooks/getCourseHours";

function formatScheduleHour(hour: Date | null | undefined) {
  if (!hour) return "";
  return hour.toISOString().slice(11, 16);
}

function formatTeacherName(user?: {
  name?: string | null;
  postnom?: string | null;
  prenom?: string | null;
} | null) {
  if (!user) return "";
  return [user.name, user.postnom, user.prenom].filter(Boolean).join(" ").trim();
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

function buildDisplayTimeSlots(slots: string[], recreationHour: string) {
  const uniqueSlots = new Set(slots.filter(Boolean));
  if (recreationHour) uniqueSlots.add(recreationHour);
  return Array.from(uniqueSlots).sort(
    (a, b) => timeToMinutes(a) - timeToMinutes(b),
  );
}

function scopedTeachingWhere(
  branchId: string,
  organizationId: string,
  extra: Record<string, unknown> = {},
) {
  return {
    ...extra,
    OR: [{ branchId }, { branchId: null }],
    classe: {
      branchId,
      branch: { organizationId },
    },
    cours: {
      branchId,
      branch: { organizationId },
    },
    schoolYear: {
      branchId,
      isCurrentYear: true,
      branch: { organizationId },
    },
    teacher: {
      branchMember: {
        branchId,
        member: { organizationId },
      },
    },
  };
}

export async function buildStudentScheduleData(
  classeId: string | null | undefined,
  branchId: string,
  organizationId: string,
): Promise<StudentScheduleData | null> {
  if (!classeId) return null;

  const classe = await prisma.classe.findFirst({
    where: {
      id: classeId,
      branchId,
      branch: { organizationId },
    },
    select: {
      nameClasse: true,
      codeClasse: true,
      creneau: {
        select: {
          startTime: true,
          endTime: true,
          durationCourse: true,
          recreationHour: true,
          recreationDuration: true,
        },
      },
    },
  });

  if (!classe) return null;

  const schedules = await prisma.schedule.findMany({
    where: {
      isArchived: false,
      teaching: scopedTeachingWhere(branchId, organizationId, { classeId }),
    },
    include: {
      teaching: {
        include: {
          cours: { select: { nameCours: true } },
          teacher: {
            include: {
              branchMember: {
                include: {
                  member: {
                    include: {
                      user: {
                        select: {
                          name: true,
                          postnom: true,
                          prenom: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ hour: "asc" }, { day: "asc" }],
  });

  const entries: StudentScheduleEntry[] = schedules.map((schedule) => ({
    id: schedule.id,
    day: schedule.day,
    hourStart: formatScheduleHour(schedule.hour),
    courseName: schedule.teaching?.cours?.nameCours ?? "—",
    teacherName: formatTeacherName(
      schedule.teaching?.teacher?.branchMember?.member?.user,
    ),
  }));

  let timeSlots: string[] = [];
  let recreationHour = "";
  let endTime = "";

  if (classe.creneau) {
    const creneau = classe.creneau;
    recreationHour = formatScheduleHour(creneau.recreationHour);
    endTime = formatScheduleHour(creneau.endTime);

    timeSlots = genererCreneaux(
      new Date(`2000-01-01T${formatScheduleHour(creneau.startTime)}`),
      new Date(`2000-01-01T${endTime}`),
      creneau.durationCourse,
      new Date(`2000-01-01T${recreationHour}`),
      creneau.recreationDuration,
    );
  } else {
    timeSlots = Array.from(new Set(entries.map((entry) => entry.hourStart))).sort(
      (a, b) => timeToMinutes(a) - timeToMinutes(b),
    );
  }

  return {
    classLabel: classe.nameClasse ?? classe.codeClasse ?? "Classe",
    classCode: classe.codeClasse ?? "",
    timeSlots: buildDisplayTimeSlots(timeSlots, recreationHour),
    recreationHour,
    endTime,
    entries,
  };
}
