import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { getPeopleLabels } from "@/lib/people-labels";

import { Card } from "@/components/ui/card";
import { Layout, LayoutBody } from "@/components/custom/layout";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { IconUser } from "@tabler/icons-react";

import { CalendarDays, Mail, Phone } from "lucide-react";

import { normalizeImageSrc } from "@/lib/utils";
import TeacherScheduleTable, {
  TeacherScheduleUI,
} from "./TeacherScheduleTable";
import { genererCreneaux } from "../components/type";
import StudentAttendanceTable from "../../attendance/component/StudentAttendanceTable";
import { getTeacherCurrentSessions } from "../../attendance/attendance.action";
import { getAttendanceSessionById } from "../../attendance/attendance.action";
import { StaffBadgeSection } from "../../components/staff-badge-section";
import { getStaffBadgeAction } from "../../staff-badge.action";

export const dynamic = "force-dynamic";

const SingleTeacherPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  /* ================= AUTH ================= */
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();

  const { typebranch } = await requireBranchContext();
  const peopleLabels = getPeopleLabels(typebranch);

  const { id } = await params;

  /* ================= TEACHER FETCH ================= */
  const teacher = await prisma.teacher.findFirst({
    where: {
      OR: [
        { id },
        {
          branchMember: {
            member: {
              userId: id,
            },
          },
        },
      ],
    },
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
      teaching: {
        include: {
          cours: true,
          classe: true,
          Schedule: true,
        },
      },
    },
  });

  if (!teacher) return notFound();

  /* 👇 AJOUT IMPORTANT */
  const user = teacher.branchMember?.member?.user;

  /* ================= CLASSE ID ================= */
  const firstClasseId = teacher.teaching.find((t) => t.classeId)?.classeId;

  /* ================= CRENEAU ================= */
  const creneau = await prisma.creneau.findFirst({
    where: {
      classe: {
        some: {
          id: firstClasseId ?? "",
        },
      },
    },
  });

  /* ================= HOURS GENERATION ================= */
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

  /* ================= FORMATTED DATA ================= */
  const courses = teacher.teaching.map((t) => ({
    id: t.id,
    cours: t.cours?.nameCours,
    classe: t.classe?.codeClasse,
  }));

  const classeIds = teacher.teaching.map((t) => t.classe?.id).filter(Boolean);

  const attendanceSession = await getTeacherCurrentSessions(teacher.id);
  const teacherBadge = await getStaffBadgeAction("teacher", teacher.id);

  /* ================= UI ================= */
  return (
    <Layout>
      <LayoutBody className="space-y-4">
        {/* HEADER */}
        <PageHeader
          title={peopleLabels.teacher}
          description={`Vue d'ensemble des informations et activités du ${peopleLabels.teacherLower}.`}
          badge={
            <Badge variant="outline-primary" icon={<IconUser size={14} />}>
              {peopleLabels.teacher}
            </Badge>
          }
        />

        <Card className="flex-1 p-8 flex flex-col xl:flex-row gap-6 rounded-2xl">
          {/* ================= LEFT ================= */}
          <div className="flex-1 min-w-0 flex flex-col gap-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* PROFILE */}
              <Card className="bg-kalasa-sky py-6 px-4 flex gap-4 rounded-2xl lg:col-span-7">
                <div className="w-1/3 flex justify-center">
                  <Image
                    src={normalizeImageSrc(user?.image)}
                    alt="teacher"
                    width={144}
                    height={144}
                    className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-md"
                  />
                </div>

                <div className="w-2/3 flex flex-col justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-semibold">
                      {user?.name} {user?.prenom}
                    </h1>

                    <p className="text-sm text-gray-500 mt-2">
                      {peopleLabels.teacher} de l&apos;établissement
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-y-3 text-sm">
                    <div className="w-full md:w-1/2 flex items-center gap-2">
                      <Mail size={15} />
                      <span>{user?.email || "-"}</span>
                    </div>

                    <div className="w-full md:w-1/2 flex items-center gap-2">
                      <Phone size={15} />
                      <span>{user?.telephone || "-"}</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* SMALL CARDS */}
              <div className="grid grid-cols-2 gap-4 xl:col-span-5">
                {/* ATTENDANCE */}
                <Card className="bg-kalasa-sky-light p-4 rounded-xl flex gap-4 items-center min-h-[100px]">
                  <div className="text-2xl">📋</div>

                  <div>
                    <h1 className="text-xl font-semibold">42</h1>

                    <span className="text-sm text-gray-400">Présences</span>
                  </div>
                </Card>

                {/* BRANCH */}
                <Card className="bg-kalasa-sky-light p-4 rounded-xl flex gap-4 items-center min-h-[100px]">
                  <div className="text-2xl">🌿</div>

                  <div>
                    <h1 className="text-xl font-semibold">4</h1>

                    <span className="text-sm text-gray-400">Branche</span>
                  </div>
                </Card>

                {/* LESSONS */}
                <Card className="bg-kalasa-sky-light p-4 rounded-xl flex gap-4 items-center min-h-[100px]">
                  <div className="text-2xl">📚</div>

                  <div>
                    <h1 className="text-xl font-semibold">{courses.length}</h1>

                    <span className="text-sm text-gray-400">Cours</span>
                  </div>
                </Card>

                {/* CLASSES */}
                <Card className="bg-kalasa-sky-light p-4 rounded-xl flex gap-4 items-center min-h-[100px]">
                  <div className="text-2xl">🏫</div>

                  <div>
                    <h1 className="text-xl font-semibold">
                      {classeIds.length}
                    </h1>

                    <span className="text-sm text-gray-400">Classes</span>
                  </div>
                </Card>
              </div>
            </div>

            {/* SCHEDULE */}
            <Card className="p-6 rounded-2xl">
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-4">
                <CalendarDays size={18} />
                Emploi du temps
              </h2>

              <TeacherScheduleTable
                teaching={teacher.teaching as TeacherScheduleUI[]}
                hoursFromProps={heuresDebut}
              />
            </Card>
            <Card className="p-6 rounded-2xl">
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-4">
                <CalendarDays size={18} />
                Attendance
              </h2>
              {attendanceSession.length > 0 ? (
                attendanceSession.map((session) => (
                  <StudentAttendanceTable key={session.id} session={session} />
                ))
              ) : (
                <p className="text-muted-foreground">
                  Aucun cours programmé actuellement.
                </p>
              )}
            </Card>
          </div>

          {/* ================= RIGHT ================= */}
          <div className="w-full xl:w-[320px] flex-shrink-0 flex flex-col gap-6">
            {teacherBadge ? <StaffBadgeSection badge={teacherBadge} /> : null}

            {/* SHORTCUTS */}
            <Card className="p-5 rounded-2xl">
              <h2 className="font-semibold mb-4">Raccourcis</h2>

              <div className="space-y-2 text-sm">
                <Link
                  className="block p-3 rounded-lg bg-sky-50 hover:bg-sky-100 transition"
                  href={`/list/teachers/${teacher.id}`}
                >
                  📚 Mes cours
                </Link>

                <Link
                  className="block p-3 rounded-lg bg-purple-50 hover:bg-purple-100 transition"
                  href={`/list/classes?teacherId=${teacher.id}`}
                >
                  🏫 Mes classes
                </Link>

                <Link
                  className="block p-3 rounded-lg bg-yellow-50 hover:bg-yellow-100 transition"
                  href={`/list/schedule?teacherId=${teacher.id}`}
                >
                  📅 Mon planning
                </Link>
              </div>
            </Card>

            {/* COURSES (MOVED HERE) */}
            <Card className="p-5 rounded-2xl">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                📘 Cours assignés
              </h2>

              {courses.length > 0 ? (
                <div className="space-y-2">
                  {courses.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 rounded-lg border bg-white hover:shadow-sm transition"
                    >
                      <p className="font-medium text-gray-800">{c.cours}</p>
                      <p className="text-sm text-gray-500">
                        Classe: {c.classe}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Aucun cours assigné</p>
              )}
            </Card>
          </div>
        </Card>
      </LayoutBody>
    </Layout>
  );
};

export default SingleTeacherPage;
