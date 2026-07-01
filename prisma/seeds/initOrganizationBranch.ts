import { prisma as Prisma } from "@/lib/prisma";
import {
  ensureSeedBranch,
  ensureSeedOrganization,
  SEED_ORGANIZATION_SLUG,
} from "./seedContext";

export async function initOrganizationBranch() {
  console.log("Initialisation de l'organisation et de la branche seed...");

  const organization = await ensureSeedOrganization();
  const branch = await ensureSeedBranch();

  console.log(
    `OK organisation ${organization.slug} / branche ${branch.code ?? branch.id}`,
  );
}

export async function clearOrganizationBranch() {
  console.log("Suppression de l'organisation seed...");

  await Prisma.organization.deleteMany({
    where: { slug: SEED_ORGANIZATION_SLUG },
  });

  console.log("OK organisation seed supprimee");
}
