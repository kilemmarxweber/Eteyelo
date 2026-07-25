/**
 * Unit 11 — inventaire comptes QA sur branche PRIMAIRE.
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";

const TARGET_ROLES = [
  "directeur",
  "prefet",
  "directeur_etudes",
  "teacher",
  "caissier",
  "student",
  "parent",
  "gestionnaire",
] as const;

async function main() {
  const branches = await prisma.branch.findMany({
    where: { typebranch: "PRIMAIRE", isActive: true },
    select: { id: true, name: true, organizationId: true },
  });

  console.log(JSON.stringify({ primaireBranches: branches }, null, 2));

  for (const branch of branches) {
    const members = await prisma.member.findMany({
      where: {
        organizationId: branch.organizationId,
        role: { in: [...TARGET_ROLES] },
        isArchived: false,
      },
      select: {
        role: true,
        user: { select: { email: true, username: true, name: true } },
        branchMember: {
          where: { branchId: branch.id },
          select: {
            role: true,
            teacher: {
              select: {
                teaching: {
                  where: { branchId: branch.id },
                  select: { titulaire: true, statusTeaching: true },
                },
              },
            },
          },
        },
      },
    });

    const byRole: Record<string, Array<Record<string, unknown>>> =
      Object.fromEntries(TARGET_ROLES.map((role) => [role, []]));

    for (const member of members) {
      const onBranch = member.branchMember[0];
      const teachings = onBranch?.teacher?.[0]?.teaching ?? [];
      const isTitulaire = teachings.some((t) => t.titulaire === true);
      byRole[member.role]?.push({
        email: member.user.email,
        username: member.user.username,
        name: member.user.name,
        onBranch: Boolean(onBranch),
        branchRole: onBranch?.role ?? null,
        isTitulaire: member.role === "teacher" ? isTitulaire : undefined,
      });
    }

    console.log(
      JSON.stringify(
        {
          branch: branch.name,
          branchId: branch.id,
          orgId: branch.organizationId,
          membersByRole: byRole,
          counts: Object.fromEntries(
            TARGET_ROLES.map((role) => [role, byRole[role]?.length ?? 0]),
          ),
        },
        null,
        2,
      ),
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
