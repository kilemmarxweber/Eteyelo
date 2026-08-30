import { prisma } from "@/lib/prisma";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { getServerTranslator } from "@/lib/i18n-server";
import { AttendanceReportsClient } from "../components/attendance-reports-client";

export const dynamic = "force-dynamic";

export default async function AttendanceReportsPage() {
  const { branchId } = await requireBranchContext();
  const t = await getServerTranslator("attendance");

  const [teachers, classes] = await Promise.all([
    prisma.teacher.findMany({
      where: {
        branchMember: { branchId },
      },
      select: {
        id: true,
        branchMember: {
          select: {
            member: {
              select: {
                user: {
                  select: { name: true, postnom: true, prenom: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    prisma.classe.findMany({
      where: {
        branchId,
        OR: [{ statusClasse: true }, { statusClasse: null }],
      },
      select: { id: true, nameClasse: true, codeClasse: true },
      orderBy: [{ level: "asc" }, { nameClasse: "asc" }],
    }),
  ]);

  return (
    <AttendanceReportsClient
      teachers={teachers.map((teacher) => {
        const user = teacher.branchMember?.member?.user;
        const name =
          [user?.name, user?.postnom, user?.prenom]
            .filter(Boolean)
            .join(" ")
            .trim() || t("personType.teacher");
        return { id: teacher.id, name };
      })}
      classes={classes.map((classe) => ({
        id: classe.id,
        name:
          classe.nameClasse?.trim() ||
          classe.codeClasse?.trim() ||
          t("reportCards.classFallback"),
      }))}
    />
  );
}
