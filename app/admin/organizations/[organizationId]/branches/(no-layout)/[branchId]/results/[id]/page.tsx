import { BranchPageShell } from "@/components/layout/branch-page-shell";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ResultTable from "./ResultTable";
import { Badge } from "@/components/ui/badge";
import { BackLink } from "@/components/ui/back-link";
import { Card } from "@/components/ui/card";
import { IconChartBar } from "@tabler/icons-react";
import { getSchoolYear } from "@/lib/school-year";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import {
  enforceResultsAreaAccess,
  isCursusSelfScopedRole,
  listAccessibleCursusStudents,
  resolveScopedCursusStudent,
} from "@/lib/auth/cursus-scope";

export const dynamic = "force-dynamic";

const StudentResultPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{
    organizationId: string;
    branchId: string;
    id: string;
  }>;
  searchParams: Promise<{ studentId?: string; period?: string }>;
}) => {
  const { organizationId, branchId: branchIdParam, id } = await params;

  const sp = await searchParams;
  const { studentId, period } = sp;

  const subjectName = decodeURIComponent(id);
  const { session, userId, branchId, typebranch } = await requireBranchContext();
  const listHref = `/admin/organizations/${organizationId}/branches/${branchIdParam}/results`;
  const role = enforceResultsAreaAccess(session);

  // studentIds scopés (unit-05) — jamais un autre élève via ?studentId=
  let targetStudentIds: string[] = [];

  if (role === "admin" || role === "teacher") {
    targetStudentIds = [];
  } else if (isCursusSelfScopedRole(role)) {
    const accessible = await listAccessibleCursusStudents({
      role,
      userId,
      branchId,
    });
    if (studentId) {
      const scoped = await resolveScopedCursusStudent({
        role,
        userId,
        branchId,
        requestedStudentId: studentId,
      });
      targetStudentIds = [scoped.id];
    } else {
      targetStudentIds = accessible.map((s) => s.id);
    }
  } else {
    notFound();
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

    const notesToShow =
      role === "admin" || role === "teacher"
        ? studentId
          ? notesParsed.filter((n) => n.studentId === studentId)
          : notesParsed
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
        ficheId: fiche.id,
        name: `${fiche.typeFiche}-${index} ${
          fiche.lesson.cours?.nameCours ?? fiche.coursName ?? "N/A"
        }`,
        date: fiche.dateCreated?.toISOString().split("T")[0] ?? "",
        note: note.score ?? 0,
        total: note.maxScore ?? 0,
        status: note.score === 0 ? " En cours" : "",
        periodName: fiche.periodeName,

        Maxscore: note.maxScore ?? 0,
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
    <BranchPageShell
      variant="compact"
          title="Détail des interventions"
          description={`Évaluations · ${subjectName}${period ? ` · ${period}` : ""}`}
          badge={
            <Badge variant="outline-primary" icon={<IconChartBar size={14} />}>
              Resultats
            </Badge>
          }
          breadcrumbs={
            <BackLink href={listHref} label="Gestion des résultats" />
          }
    >
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
              <ResultTable
                data={tableData}
                totalPercentage="0"
                typebranch={typebranch}
              />
            </div>
          </div>
        </Card>
    </BranchPageShell>
  );
};

export default StudentResultPage;
