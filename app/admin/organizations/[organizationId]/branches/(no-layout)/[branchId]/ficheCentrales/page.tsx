import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ORG_ROLE } from "@/lib/permissions";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import {
  canManageOrganization,
  hasSessionRole,
} from "@/lib/auth/session-roles";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import FichecentralTable from "./components/FichecentralTable";
import { getSchoolYear } from "@/lib/school-year";

const StudentResultPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; branchId: string; id?: string }>;
  searchParams: Promise<{ studentId?: string; period?: string }>;
}) => {
  const { organizationId, branchId, id } = await params;

  const sp = await searchParams;
  const { studentId, period } = sp;

  const subjectName = decodeURIComponent(id ?? "");
  const { session, userId, branchId: activeBranchId } =
    await requireBranchContext();
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
          { branchId: activeBranchId },
          {
            branchId: null,
            classe: {
              branchId: activeBranchId,
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
        name: `${fiche.typeFiche}-${index} ${fiche.lesson.cours?.nameCours ?? fiche.coursName ?? "N/A"}`,
        date: fiche.dateCreated?.toISOString().split("T")[0] ?? "",
        note: note.score ?? 0,
        total: note.maxScore ?? 0,
        status: note.score === 0 ? " En cours" : "",
        periodName: fiche.periodeName,
        Maxscore: note.maxScore ?? 0,
        TypeFiche: fiche.typeFiche,
        Comment: note.comment,
        studentId: note.studentId,
      };
    });
  });

  return (
    <div className="space-y-6 w-full">
      {/* ===== IDENTITÉ ===== */}
      <Card>
        <CardHeader>
          <CardTitle>Identité</CardTitle>
          <CardDescription>
            Vos informations de base et d'identification.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <FichecentralTable organizationId={organizationId} branchId={branchId} />
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentResultPage;
