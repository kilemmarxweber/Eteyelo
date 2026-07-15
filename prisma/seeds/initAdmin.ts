import { BranchRole } from "@/prisma/generated/prisma/client";
import { prisma as Prisma } from "@/lib/prisma";
import { ensureSeedMember } from "./seedContext";

export async function initAdmin() {
  console.log("Initialisation de l'administrateur...");

  const adminUser = await Prisma.user.findFirst({
    where: { username: "admin" },
  });

  if (!adminUser) {
    console.warn("Utilisateur admin non trouve");
    return;
  }

  const { branchMember } = await ensureSeedMember(
    adminUser.id,
    "gestionnaire",
    BranchRole.ADMIN,
  );

  console.log(`OK administrateur lie a la branche (${branchMember.id})`);
}

export async function clearAdmin() {
  console.log("Clear admin ignore: l'admin est porte par Member/BranchMember.");
}
