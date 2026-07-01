import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ResultTable from "./ResultTable";
import { Layout, LayoutBody } from "@/components/custom/layout";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { IconChartBar } from "@tabler/icons-react";
import { getSchoolYear } from "@/lib/school-year";
import { ORG_ROLE } from "@/lib/permissions";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import {
  canManageOrganization,
  hasSessionRole,
} from "@/lib/auth/session-roles";
const StudentResultPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ studentId: string; period: string }>;
}) => {
  const { id } = await params;

  const sp = await searchParams;
  const { studentId, period } = sp;

  const subjectName = decodeURIComponent(id);
  const { session, userId, branchId } = await requireBranchContext();
  const canManage = canManageOrganization(session);
  const role = canManage
    ? "admin"
    : hasSessionRole(session, [ORG_ROLE.PARENT, "PARENT"])
      ? "parent"
      : hasSessionRole(session, [ORG_ROLE.STUDENT, "STUDENT"])
        ? "student"
        : "guest";
  const currentUserId = userId;

  if (role === "guest") {
    redirect("/not-authorized");
  }

  // ✅ déterminer les studentIds selon rôle
  let targetStudentIds: string[] = [];

  if (role === "admin") {
    targetStudentIds = [];
  } else if (role === "parent") {
    if (studentId) targetStudentIds = [studentId];
  } else {
    if (currentUserId) targetStudentIds = [currentUserId];
  }

  // ✅ récupérer les fiches (sans filtre period ici)
  const fiches = await prisma.fiche.findMany({
    where: {
      typeFiche: { not: "ficheCote" },
      anneeName: (await getSchoolYear())?.nameYear,
      ...(period && {
        periodeName: period, // 🔥 filtre période
      }),
      lesson: {
        OR: [
          { branchId },
          {
            branchId: null,
            classe: {
              branchId,
            },
          },
        ],
        cours: {
          nameCours: subjectName,
        },
      },
    },
    include: {
      lesson: {
        include: {
          cours: true,
        },
      },
    },
  });

  const groupIndexMap: Record<string, number> = {};

  const tableData = fiches.flatMap((fiche) => {
    let notesParsed: any[] = [];

    try {
      notesParsed = fiche.notes ? JSON.parse(fiche.notes) : [];
    } catch {
      notesParsed = [];
    }

    // ✅ filtre par student
    const notesToShow =
      role === "admin"
        ? studentId
          ? notesParsed.filter((n) => n.studentId === studentId)
          : notesParsed // 🔥 admin voit tout si pas de studentId
        : notesParsed.filter((n) => targetStudentIds.includes(n.studentId));
    if (!notesToShow.length) return [];

    // ✅ filtre par period (JS)
    const isSamePeriod = period ? fiche.periodeName === period : true;

    if (!isSamePeriod) return [];

    const key = `${fiche.typeFiche}-${fiche.periodeName}`;

    return notesToShow.map((note) => {
      if (!groupIndexMap[key]) {
        groupIndexMap[key] = 1;
      } else {
        groupIndexMap[key] += 1;
      }

      const index = groupIndexMap[key];

      return {
        id: `${fiche.id}-${note.studentId}`,
        name: `${fiche.typeFiche}-${index} ${
          fiche.lesson.cours?.nameCours ?? fiche.coursName ?? "N/A"
        }`,
        date: fiche.dateCreated?.toISOString().split("T")[0] ?? "",
        note: note.score ?? 0,
        total: note.maxScore ?? 0,
        status: note.score === 0 ? " En cours" : "",
        periodName: fiche.periodeName,

        Maxscore: (fiche.lesson.cours?.ponderation ?? 0) * 10,
        TypeFiche: fiche.typeFiche,
        Comment: note.comment ?? "",

        studentId: note.studentId,

        // ✅ FIX ICI
        yearName: fiche.anneeName ?? "",

        // ⚠️ assure que c'est bien un number
        classId: Number(fiche.classSectionId) || 0,

        sexe: note.sexe ?? "",
      };
    });
  });

  return (
    <Layout>
      <LayoutBody className="space-y-4">
        <PageHeader
          title="Gestion des Resultats"
          description="Gérer les informations des Resultats des élèves"
          badge={
            <Badge variant="outline-primary" icon={<IconChartBar size={14} />}>
              Resultats
            </Badge>
          }
        />
        <Card
          variant="default"
          className="mt-0 border flex flex-col xl:flex-row gap-2 rounded-md shadow-sm"
        >
          <div className="w-full xl:w-2/3">
            {/* ================= GAUCHE ================= */}
            <div className="flex-1 p-6 rounded-md">
              <div className="flex justify-between items-center mb-8">
                <h1 className="text-lg font-semibold">
                  Evaluations : {subjectName}
                </h1>
              </div>
              <ResultTable data={tableData} totalPercentage="0" />
            </div>
          </div>
        </Card>
      </LayoutBody>
    </Layout>
  );
};

export default StudentResultPage;
