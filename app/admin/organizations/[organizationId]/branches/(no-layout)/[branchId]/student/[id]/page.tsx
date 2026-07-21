import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { IconUser } from "@tabler/icons-react";

import { Layout, LayoutBody } from "@/components/custom/layout";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/auth";
import {
  canManageOrganization,
  hasSessionRole,
} from "@/lib/auth/session-roles";
import { ORG_ROLE } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  buildStudentBadgeQrCode,
  formatStudentBadgeDate,
  type StudentBadgeData,
} from "@/lib/student-badge";
import { listBranchPeriodOptions } from "@/lib/academic-periods";
import { buildReleveNotesData } from "@/lib/releve-notes-builder";
import { buildStudentDocumentsData } from "@/lib/student-documents";
import { buildStudentScheduleData } from "@/lib/student-schedule";
import { buildStudentAnnouncementsData } from "@/lib/student-announcements";
import { getPeopleLabels } from "@/lib/people-labels";
import { getBranchImage } from "@/lib/utils";
import { StudentProfileClient } from "./components/student-profile-client";
import type {
  StudentProfileData,
  StudentProfileFee,
  StudentProfileFinanceSummary,
  StudentProfileSemester,
} from "./components/student-profile-types";

export const dynamic = "force-dynamic";

function safeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function calculateAge(dateOfBirth: Date | string | null | undefined) {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const birthdayNotReached =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (birthdayNotReached) age -= 1;
  return age >= 0 ? age : null;
}

function formatTeacherName(user?: {
  name?: string | null;
  postnom?: string | null;
  prenom?: string | null;
} | null) {
  if (!user) return "Non assigne";
  const fullName = [user.name, user.postnom, user.prenom].filter(Boolean).join(" ");
  return fullName || "Non assigne";
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
    notFound();
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

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, organizationId },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!branch) notFound();

  const peopleLabels = getPeopleLabels(branch.typebranch);

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
                  titulaire: true,
                },
                include: {
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
    notFound();
  }

  const nom = user.name ?? "";
  const postnom = user.postnom ?? "";
  const prenom = user.prenom ?? "";
  const fullName =
    [nom, postnom, prenom].filter(Boolean).join(" ").trim() || peopleLabels.student;
  const age = calculateAge(user.dateOfBirth);
  const sectionName = classe?.option?.section?.nameSection ?? "-";
  const optionName = classe?.option?.nameOption ?? "-";
  const classLabel = classe
    ? `${classe.nameClasse ?? classe.codeClasse ?? "-"} (${sectionName})`
    : "Non assigne";
  const matricule =
    user.username?.trim() ||
    `ELV-${new Date().getFullYear()}-${student.id.slice(-6).toUpperCase()}`;
  const statusActive = student.statusStudent !== false;
  const titulaireTeacher = classe?.teaching?.[0]?.teacher?.branchMember?.member
    ?.user;
  const branchImages = getBranchImage(branch.image);
  const yearId = currentYear?.id ?? enrollment?.schoolYearId ?? "na";
  const yearCode =
    currentYear?.nameYear ??
    enrollment?.schoolYear?.nameYear ??
    new Date().getFullYear().toString();

  const parentFullName = parentUser
    ? [parentUser.name, parentUser.postnom, parentUser.prenom]
        .filter(Boolean)
        .join(" ")
    : "-";

  const badge: StudentBadgeData = {
    studentId: student.id,
    userId: user.id,
    lastName: nom,
    postName: postnom,
    firstName: prenom,
    fullName,
    img: user.image,
    sexe: user.sexe,
    dateOfBirth: user.dateOfBirth,
    placeOfBirth: student.placeOfBirth,
    nationality: branch.pays ?? "Congolaise",
    matricule,
    className: classLabel,
    schoolName: branch.name,
    yearCode,
    yearId,
    branchId,
    organizationId,
    organizationName: branch.organization.name,
    organizationLogo: branchImages.logo ?? null,
    branchLogo: branchImages.logo ?? null,
    parentName: parentFullName !== "-" ? parentFullName : null,
    parentPhone: parentUser?.telephone ?? null,
    qrCode: buildStudentBadgeQrCode(student.id, yearId, branchId),
    displayId: student.id.slice(-6).padStart(6, "0"),
  };

  const formattedFees: StudentProfileFee[] = [];
  const paymentsByFrais = new Map<string, number>();

  for (const payment of enrollment?.paiement ?? []) {
    if (payment.status !== "VALIDE") continue;
    const fraisId = payment.fraisId;
    paymentsByFrais.set(
      fraisId,
      (paymentsByFrais.get(fraisId) ?? 0) + safeNumber(payment.amount),
    );
  }

  const classFrais =
    classe?.id && currentYear?.id
      ? await prisma.frais.findMany({
          where: {
            branchId,
            classeId: classe.id,
            statusFrais: true,
            schoolYearId: currentYear.id,
          },
          include: {
            typeFrais: true,
          },
          orderBy: [{ priority: "asc" }, { nameFrais: "asc" }],
        })
      : [];

  if (classFrais.length > 0) {
    for (const frais of classFrais) {
      const amountDue = safeNumber(frais.montantFrais);
      const amountPaid = paymentsByFrais.get(frais.id) ?? 0;
      const remaining = Math.max(amountDue - amountPaid, 0);

      formattedFees.push({
        id: frais.id,
        label: frais.nameFrais,
        typeFrais: frais.typeFrais?.nameType ?? "",
        amountDue,
        amountPaid,
        remaining,
        isPaid: remaining <= 0,
      });
    }
  } else {
    const fraisFromPayments = new Map<
      string,
      {
        label: string;
        typeFrais: string;
        amountDue: number;
      }
    >();

    for (const payment of enrollment?.paiement ?? []) {
      if (!payment.frais) continue;

      fraisFromPayments.set(payment.fraisId, {
        label: payment.frais.nameFrais ?? "Frais",
        typeFrais: payment.frais.typeFrais?.nameType ?? "",
        amountDue: safeNumber(payment.frais.montantFrais),
      });
    }

    for (const [fraisId, frais] of fraisFromPayments) {
      const amountDue = frais.amountDue;
      const amountPaid = paymentsByFrais.get(fraisId) ?? 0;
      const remaining = Math.max(amountDue - amountPaid, 0);

      formattedFees.push({
        id: fraisId,
        label: frais.label,
        typeFrais: frais.typeFrais,
        amountDue,
        amountPaid,
        remaining,
        isPaid: remaining <= 0,
      });
    }
  }

  const financeSummary: StudentProfileFinanceSummary = formattedFees.reduce(
    (summary, fee) => ({
      totalDue: summary.totalDue + fee.amountDue,
      totalPaid: summary.totalPaid + fee.amountPaid,
      totalRemaining: summary.totalRemaining + fee.remaining,
    }),
    { totalDue: 0, totalPaid: 0, totalRemaining: 0 },
  );

  const [studentFiches, periodOptions, releveDataFromBuilder] = await Promise.all([
    classe?.id && currentYear?.id
      ? prisma.fiche.findMany({
          where: {
            branchId,
            anneeId: currentYear.id,
            classSectionId: classe.id,
          },
          include: {
            lesson: {
              include: {
                cours: true,
              },
            },
            period: true,
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
          },
          orderBy: { dateCreated: "desc" },
        })
      : Promise.resolve([]),
    listBranchPeriodOptions({
      branchId,
      typebranch: branch.typebranch,
      ensure: false,
    }),
    buildReleveNotesData({
      studentId: student.id,
      branchId,
      typebranch: branch.typebranch,
    }),
  ]);

  const documents = buildStudentDocumentsData({
    studentId: student.id,
    fiches: studentFiches,
    periods: periodOptions.map((period) => ({
      id: period.id,
      label: period.label,
    })),
    organizationName: branch.organization.name,
    branchName: branch.name,
    schoolYear: yearCode,
    schoolYearId: currentYear?.id ?? enrollment?.schoolYearId ?? "",
    className: classe?.nameClasse ?? classLabel,
    studentName: fullName,
    matricule,
    classLevel: classe?.level ?? null,
    optionName: optionName !== "-" ? optionName : null,
    sectionName: sectionName !== "-" ? sectionName : null,
    relevesHref: `${baseHref}/releves`,
    resultsHref: `${baseHref}/results`,
    releveData:
      releveDataFromBuilder && releveDataFromBuilder.semesters.length > 0
        ? releveDataFromBuilder
        : null,
  });

  const markData = (classe?.fiche ?? [])
    .flatMap((fiche) => {
      const semesterLabel = fiche.period?.semester?.label || "Unknown";

      try {
        const parsed = JSON.parse(fiche.notes || "[]");
        if (!Array.isArray(parsed)) return [];

        return parsed
          .filter((note: { studentId?: string }) => note.studentId === student.id)
          .map((note: { score?: unknown; maxScore?: unknown }) => ({
            mark: safeNumber(note.score),
            maxScore: safeNumber(note.maxScore),
            semester: semesterLabel,
          }));
      } catch {
        return [];
      }
    })
    .filter((mark) => mark.maxScore > 0);

  const semesters: StudentProfileSemester[] = Object.entries(
    markData.reduce<
      Record<string, { marks: number[]; max: number[] }>
    >((acc, mark) => {
      if (!acc[mark.semester]) {
        acc[mark.semester] = { marks: [], max: [] };
      }
      acc[mark.semester].marks.push(mark.mark);
      acc[mark.semester].max.push(mark.maxScore);
      return acc;
    }, {}),
  )
    .map(([label, data]) => {
      const normalized = data.marks.map(
        (mark, index) => (mark / data.max[index]) * 10,
      );
      const avg =
        normalized.reduce((total, mark) => total + mark, 0) / normalized.length;

      return {
        label,
        average: Number(avg.toFixed(1)),
        max: 10,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  if (semesters.length === 0) {
    semesters.push({ label: "No data", average: 0, max: 10 });
  }

  const schedule = await buildStudentScheduleData(
    classe?.id ?? null,
    branchId,
    organizationId,
  );

  const announcements = await buildStudentAnnouncementsData(
    branchId,
    organizationId,
    studentClassIds.filter(Boolean).length > 0
      ? studentClassIds.filter(Boolean)
      : classe?.id
        ? [classe.id]
        : [],
    currentYear?.id ?? enrollment?.schoolYearId ?? null,
  );

  const profile: StudentProfileData = {
    baseHref,
    studentListHref: `${baseHref}/student`,
    studentId: student.id,
    fullName,
    nom,
    postnom,
    prenom,
    sexe: user.sexe ?? "-",
    dateOfBirthLabel: formatStudentBadgeDate(user.dateOfBirth),
    ageLabel: age != null ? `${age} ans` : "-",
    placeOfBirth: student.placeOfBirth ?? "-",
    nationality: branch.pays ?? "Congolaise",
    bloodGroup: "-",
    allergies: "Aucune",
    vulnerability: "Aucune",
    schoolName: branch.name,
    matricule,
    schoolYearLabel: yearCode,
    classLabel,
    sectionLabel: [sectionName, optionName].filter((value) => value !== "-").join(" / ") || "-",
    optionLabel: optionName,
    titulaireName: formatTeacherName(titulaireTeacher),
    statusLabel: statusActive ? "Actif" : "Inactif",
    statusActive,
    enrollmentDateLabel: formatStudentBadgeDate(enrollment?.createdAt),
    image: user.image,
    canManageStudents: canReadAll,
    parentFullName,
    parentPhone: parentUser?.telephone ?? "-",
    parentEmail: parentUser?.email ?? "-",
    parentProfession: "-",
    parentAddress: parentUser?.address ?? "-",
    parentEmergencyContact: "-",
    displayId: badge.displayId,
    badge,
    fees: formattedFees,
    financeSummary,
    documents,
    semesters,
    classeId: classe?.id ?? null,
    schedule,
    announcements,
  };

  return (
    <Layout>
      <LayoutBody className="space-y-4">
        <PageHeader
          title={`Profil ${peopleLabels.studentLower}`}
          description={`Informations personnelles, scolarite et carte d'identite de ${peopleLabels.studentDefinite}.`}
          badge={
            <Badge variant="outline-primary" icon={<IconUser size={14} />}>
              {peopleLabels.student}
            </Badge>
          }
          className="mb-0 space-y-1"
        />

        <StudentProfileClient profile={profile} />
      </LayoutBody>
    </Layout>
  );
};

export default SingleStudentPage;
