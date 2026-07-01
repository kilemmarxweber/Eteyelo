import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle, Clock } from "lucide-react";
import { IconUser } from "@tabler/icons-react";

import BigCalendarContainer from "../components/BigCalendarContainer";
import Performance from "../components/Performance";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Layout, LayoutBody } from "@/components/custom/layout";
import { PageHeader } from "@/components/ui/page-header";
import { auth } from "@/lib/auth";
import {
  canManageOrganization,
  hasSessionRole,
} from "@/lib/auth/session-roles";
import { ORG_ROLE } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { normalizeImageSrc } from "@/lib/utils";

function safeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

const SingleStudentPage = async ({
  params,
}: {
  params: Promise<{ organizationId: string; branchId: string; id: string }>;
}) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/not-authorized");
  }

  const { organizationId, branchId, id } = await params;
  const baseHref = `/admin/organizations/${organizationId}/branches/${branchId}`;

  const currentBranchMember = await prisma.branchMember.findFirst({
    where: {
      branchId,
      member: {
        userId: session.user.id,
        organizationId,
      },
    },
    select: {
      id: true,
      role: true,
    },
  });

  const canReadAll = canManageOrganization(session, currentBranchMember?.role);

  const currentYear = await prisma.schoolYear.findFirst({
    where: {
      branchId,
      isCurrentYear: true,
    },
  });

  const student = await prisma.student.findFirst({
    where: {
      branchMember: {
        branchId,
        member: {
          organizationId,
        },
      },
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
      parent: {
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
      classEnrollment: {
        where: {
          branchId,
          ...(currentYear?.id ? { schoolYearId: currentYear.id } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          schoolYear: true,
          paiement: {
            where: { branchId },
            include: {
              frais: {
                include: {
                  typeFrais: true,
                },
              },
              allocations: true,
            },
          },
          classe: {
            include: {
              option: {
                include: { section: true },
              },
              teaching: {
                where: {
                  OR: [{ branchId }, { branchId: null }],
                },
                include: {
                  cours: true,
                  teacher: {
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
                  Schedule: true,
                },
              },
              fiche: {
                where: {
                  branchId,
                  typeFiche: "ficheCote",
                  ...(currentYear?.id ? { anneeId: currentYear.id } : {}),
                },
                include: {
                  period: {
                    include: { semester: true },
                  },
                },
              },
              creneau: true,
            },
          },
        },
      },
    },
  });

  if (!student) return notFound();

  const user = student.branchMember.member.user;
  const parentUser = student.parent.branchMember?.member.user;
  const enrollment = student.classEnrollment[0];
  const classe = enrollment?.classe;
  const studentClassIds = student.classEnrollment.map(
    (classEnrollment) => classEnrollment.classeId,
  );

  let canReadStudent =
    canReadAll ||
    user.id === session.user.id ||
    parentUser?.id === session.user.id;

  if (
    !canReadStudent &&
    currentBranchMember &&
    studentClassIds.length > 0 &&
    hasSessionRole(
      session,
      [ORG_ROLE.TEACHER, "TEACHER"],
      currentBranchMember.role,
    )
  ) {
    const teaching = await prisma.teaching.findFirst({
      where: {
        classeId: { in: studentClassIds },
        OR: [{ branchId }, { branchId: null }],
        teacher: {
          branchMemberId: currentBranchMember.id,
        },
      },
      select: { id: true },
    });

    canReadStudent = Boolean(teaching);
  }

  if (!canReadStudent) {
    redirect("/not-authorized");
  }

  const studentName =
    [user.name, user.prenom].filter(Boolean).join(" ") || "Eleve";

  const formattedFees = (enrollment?.paiement ?? []).map((payment) => ({
    id: payment.id,
    label: payment.frais?.nameFrais ?? "Frais",
    amount: safeNumber(payment.amount),
    typeFrais: payment.frais?.typeFrais?.nameType ?? "",
    status: payment.status,
  }));

  const markData = (classe?.fiche ?? [])
    .flatMap((fiche) => {
      const semesterLabel = fiche.period?.semester?.label || "Unknown";

      try {
        const parsed = JSON.parse(fiche.notes || "[]");
        if (!Array.isArray(parsed)) return [];

        return parsed
          .filter((note: any) => note.studentId === student.id)
          .map((note: any) => ({
            mark: safeNumber(note.score),
            maxScore: safeNumber(note.maxScore),
            semester: semesterLabel,
          }));
      } catch {
        return [];
      }
    })
    .filter((mark) => mark.maxScore > 0);

  const semesters = Object.entries(
    markData.reduce((acc: any, mark: any) => {
      if (!acc[mark.semester]) {
        acc[mark.semester] = { marks: [], max: [] };
      }

      acc[mark.semester].marks.push(mark.mark);
      acc[mark.semester].max.push(mark.maxScore);

      return acc;
    }, {}),
  )
    .map(([semester, data]: any) => {
      const normalized = data.marks.map(
        (mark: number, index: number) => (mark / data.max[index]) * 10,
      );
      const avg =
        normalized.reduce((total: number, mark: number) => total + mark, 0) /
        normalized.length;

      return {
        label: semester,
        average: Number(avg.toFixed(1)),
        max: 10,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  if (semesters.length === 0) {
    semesters.push({ label: "No data", average: 0, max: 10 });
  }

  return (
    <Layout>
      <LayoutBody className="space-y-4">
        <PageHeader
          title="Information et performances"
          description="Vue d'ensemble de vos details scolaires et annonces importantes."
          badge={
            <Badge variant="outline-primary" icon={<IconUser size={14} />}>
              Eleve
            </Badge>
          }
          className="mb-0 space-y-1"
        />

        <Card className="flex-1 p-8 flex flex-col gap-4 xl:flex-row rounded-2xl">
          <div className="w-full xl:w-2/2">
            <div className="flex flex-col lg:flex-row gap-4">
              <Card className="bg-kalasa-sky py-6 px-4 flex-1 flex gap-4 p-8">
                <div className="w-1/3">
                  <Image
                    src={
                      normalizeImageSrc(user.image) ||
                      "/uploads/1752330108714.jpg"
                    }
                    alt={studentName}
                    width={144}
                    height={144}
                    className="w-36 h-36 rounded-full object-cover"
                  />
                </div>

                <div className="w-2/3 flex flex-col justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <h1 className="text-xl font-semibold">{studentName}</h1>
                  </div>
                  <p className="text-sm text-gray-500">
                    Informations scolaires de l'eleve dans cette branche.
                  </p>
                  <div className="flex items-center justify-between gap-2 flex-wrap text-xs font-medium">
                    <div className="w-full md:w-1/3 flex items-center gap-2">
                      <Image
                        src="/uploads/blood.png"
                        alt=""
                        width={14}
                        height={14}
                      />
                      <span>{user.sexe || "-"}</span>
                    </div>
                    <div className="w-full md:w-1/3 flex items-center gap-2">
                      <Image
                        src="/uploads/date.png"
                        alt=""
                        width={14}
                        height={14}
                      />
                      <span>
                        {user.dateOfBirth
                          ? new Intl.DateTimeFormat("fr-FR").format(
                              user.dateOfBirth,
                            )
                          : "-"}
                      </span>
                    </div>
                    <div className="w-full md:w-1/3 flex items-center gap-2">
                      <Image
                        src="/uploads/mail.png"
                        alt=""
                        width={14}
                        height={14}
                      />
                      <span>{user.email || "-"}</span>
                    </div>
                    <div className="w-full md:w-1/3 flex items-center gap-2">
                      <Image
                        src="/uploads/phone.png"
                        alt=""
                        width={14}
                        height={14}
                      />
                      <span>{user.telephone || "-"}</span>
                    </div>
                  </div>
                </div>
              </Card>

              <div className="flex-1 flex gap-4 justify-between flex-wrap">
                <Card className="bg-kalasa-sky-light p-4 rounded-md flex gap-4 w-full md:w-[48%]">
                  <Image
                    src="/uploads/singleAttendance.png"
                    alt=""
                    width={24}
                    height={24}
                    className="w-6 h-6"
                  />
                </Card>

                <Card className="bg-kalasa-sky-light p-4 rounded-md flex gap-4 w-full md:w-[48%]">
                  <Image
                    src="/uploads/singleBranch.png"
                    alt=""
                    width={24}
                    height={24}
                    className="w-6 h-6"
                  />
                  <div>
                    <h1 className="text-xl font-semibold">
                      {classe?.option?.section?.nameSection || "No branch"}
                    </h1>
                    <span className="text-sm text-gray-400">Section</span>
                  </div>
                </Card>

                <Card className="bg-kalasa-sky-light p-4 rounded-md flex gap-4 w-full md:w-[48%]">
                  <Image
                    src="/uploads/singleLesson.png"
                    alt=""
                    width={24}
                    height={24}
                    className="w-6 h-6"
                  />
                  <div>
                    <h1 className="text-xl font-semibold">
                      {classe?.teaching.length ?? 0} Lessons
                    </h1>
                    <span className="text-sm text-gray-400">Lessons</span>
                  </div>
                </Card>

                <Card className="bg-kalasa-sky-light p-4 rounded-md flex gap-4 w-full md:w-[48%]">
                  <Image
                    src="/uploads/singleClass.png"
                    alt=""
                    width={24}
                    height={24}
                    className="w-6 h-6"
                  />
                  <div>
                    <h1 className="text-xl font-semibold">
                      {classe?.codeClasse || "-"}
                    </h1>
                    <span className="text-sm text-gray-400">Classe</span>
                  </div>
                </Card>
              </div>
            </div>

            <div className="mt-4 rounded-md p-4 h-[550px]">
              <h1>Horaire de l'eleve</h1>
              {classe ? (
                <BigCalendarContainer type="classId" id={classe.id} />
              ) : null}
            </div>
          </div>

          <div className="w-full xl:w-1/3 flex flex-col gap-4">
            <div className="bg-secondary p-4 rounded-md">
              <h1 className="text-xl font-semibold">Raccourcis</h1>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <Link
                  className="p-3 rounded-md bg-kalasa-sky-light"
                  href={`${baseHref}/classe`}
                >
                  Classes
                </Link>
                <Link
                  className="p-3 rounded-md bg-kalasa-purple-light"
                  href={`${baseHref}/teacher`}
                >
                  Enseignants
                </Link>
                <Link
                  className="p-3 rounded-md bg-kalasa-yellow-light"
                  href={`${baseHref}/cours`}
                >
                  Cours
                </Link>
                <Link
                  className="p-3 rounded-md bg-pink-50"
                  href={`${baseHref}/results/${student.id}`}
                >
                  Resultats
                </Link>
              </div>
            </div>

            <div className="p-4 bg-secondary rounded-md">
              <h1 className="text-xl font-semibold">Details des paiements</h1>

              {formattedFees.length ? (
                formattedFees.map((fee) => {
                  const isPaid = fee.amount >= 1;

                  return (
                    <div
                      key={fee.id}
                      className="flex justify-between items-center px-4 py-2 border rounded-md"
                    >
                      <span>{fee.label}</span>
                      <span>${fee.amount}</span>
                      {isPaid ? (
                        <CheckCircle className="text-green-500" />
                      ) : (
                        <Clock className="text-yellow-500" />
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucun paiement trouve.
                </p>
              )}
            </div>

            <Performance semesters={semesters} />
          </div>
        </Card>
      </LayoutBody>
    </Layout>
  );
};

export default SingleStudentPage;
