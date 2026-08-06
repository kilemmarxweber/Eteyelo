import { prisma } from "@/lib/prisma";
import { SYSTEM_PRIMARY_DOMAIN_DEFS } from "@/lib/primary-domains";

/** Crée les 5 domaines RDC s'ils manquent pour la branche. */
export async function ensureBranchPrimaryDomains(branchId: string) {
  const existing = await prisma.branchPrimaryDomain.findMany({
    where: { branchId },
    select: { code: true },
  });
  const have = new Set(existing.map((d) => d.code));
  const missing = SYSTEM_PRIMARY_DOMAIN_DEFS.filter((d) => !have.has(d.code));
  if (missing.length === 0) return;

  await prisma.branchPrimaryDomain.createMany({
    data: missing.map((d) => ({
      branchId,
      code: d.code,
      label: d.label,
      shortLabel: d.shortLabel,
      sortOrder: d.sortOrder,
      isSystem: true,
    })),
    skipDuplicates: true,
  });
}

export async function listBranchPrimaryDomains(branchId: string) {
  await ensureBranchPrimaryDomains(branchId);
  return prisma.branchPrimaryDomain.findMany({
    where: { branchId },
    orderBy: [{ sortOrder: "asc" }, { shortLabel: "asc" }],
    select: {
      id: true,
      code: true,
      label: true,
      shortLabel: true,
      sortOrder: true,
      isSystem: true,
    },
  });
}
