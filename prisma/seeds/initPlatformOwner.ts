import { prisma as Prisma } from "@/lib/prisma";
import { APP_ROLE } from "@/lib/permissions";

const OWNER_EMAIL = "owner@eteyelo.cd";

export async function initPlatformOwner() {
  console.log("Initialisation du proprietaire plateforme...");

  const owner = await Prisma.user.findFirst({
    where: { email: OWNER_EMAIL },
  });

  if (!owner) {
    console.warn(
      "Utilisateur owner introuvable. Executez initUsers avant initPlatformOwner.",
    );
    return;
  }

  if (owner.role !== APP_ROLE.OWNER) {
    await Prisma.user.update({
      where: { id: owner.id },
      data: { role: APP_ROLE.OWNER },
    });
  }

  const removedMemberships = await Prisma.member.deleteMany({
    where: { userId: owner.id },
  });

  if (removedMemberships.count > 0) {
    console.log(
      `  Membership(s) retire(s) du proprietaire plateforme: ${removedMemberships.count}`,
    );
  }

  console.log("OK proprietaire plateforme sans membership organisation");
}

export async function clearPlatformOwner() {
  console.log("Clear platform owner ignore: compte gere par initUsers.");
}
