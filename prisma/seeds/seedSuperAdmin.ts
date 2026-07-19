import "dotenv/config";
import { randomUUID } from "crypto";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/prisma";
import { APP_ROLE } from "@/lib/permissions";

const SUPER_ADMIN_PASSWORD = "K@#&klambocore04";
const KILEM_IMAGE = "/uploads/kilem.jpeg";

const PROFILE = {
  name: "Kilem",
  prenom: "Yannick",
  postnom: null as string | null,
  telephone: "+243844952966",
  image: KILEM_IMAGE,
} as const;

function resolveEmail() {
  const email = process.env.SMTP_USER?.trim();
  if (!email) {
    throw new Error(
      "SMTP_USER manquant dans .env — requis pour le seed super admin.",
    );
  }
  return email.toLowerCase();
}

function usernameFromEmail(email: string) {
  const local = email.split("@")[0]?.replace(/[^a-zA-Z0-9._-]/g, "") || "owner";
  return local.slice(0, 48) || "owner";
}

/**
 * Super admin plateforme (APP_ROLE.OWNER).
 * Email = SMTP_USER (.env). Pas de membership org (accès root plateforme).
 */
export async function seedSuperAdmin() {
  console.log("Initialisation du super admin (owner)...");

  const email = resolveEmail();
  const username = usernameFromEmail(email);
  const hashedPassword = await hashPassword(SUPER_ADMIN_PASSWORD);

  const existingByEmail = await prisma.user.findUnique({
    where: { email },
  });

  let user = existingByEmail;

  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        email,
        username,
        name: PROFILE.name,
        prenom: PROFILE.prenom,
        postnom: PROFILE.postnom,
        telephone: PROFILE.telephone,
        image: PROFILE.image,
        role: APP_ROLE.OWNER,
        emailVerified: true,
        statusUser: true,
        mustChangePassword: false,
        banned: false,
        banReason: null,
        banExpires: null,
      },
    });
    console.log(`  Utilisateur existant mis à jour: ${email}`);
  } else {
    const usernameTaken = await prisma.user.findFirst({
      where: { username },
      select: { id: true },
    });
    const finalUsername = usernameTaken ? `owner-${Date.now()}` : username;

    user = await prisma.user.create({
      data: {
        email,
        username: finalUsername,
        name: PROFILE.name,
        prenom: PROFILE.prenom,
        postnom: PROFILE.postnom,
        telephone: PROFILE.telephone,
        image: PROFILE.image,
        role: APP_ROLE.OWNER,
        emailVerified: true,
        statusUser: true,
        mustChangePassword: false,
      },
    });
    console.log(`  Utilisateur créé: ${email}`);
  }

  const existingAccount = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
  });

  if (existingAccount) {
    await prisma.account.update({
      where: { id: existingAccount.id },
      data: {
        accountId: user.id,
        password: hashedPassword,
        updatedAt: new Date(),
      },
    });
  } else {
    await prisma.account.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: hashedPassword,
      },
    });
  }

  // Owner plateforme : pas de membership organisation
  const removed = await prisma.member.deleteMany({
    where: { userId: user.id },
  });
  if (removed.count > 0) {
    console.log(`  Membership(s) retiré(s): ${removed.count}`);
  }

  console.log(
    `OK super admin owner — ${PROFILE.prenom} ${PROFILE.name} (${email})`,
  );
  return user;
}

export async function clearSuperAdmin() {
  console.log("Suppression du super admin...");
  const email = process.env.SMTP_USER?.trim()?.toLowerCase();
  if (!email) {
    console.warn("SMTP_USER absent — clear super admin ignoré.");
    return 0;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) {
    console.log("  Aucun super admin à supprimer.");
    return 0;
  }

  await prisma.session.deleteMany({ where: { userId: user.id } });
  await prisma.account.deleteMany({ where: { userId: user.id } });
  await prisma.member.deleteMany({ where: { userId: user.id } });
  await prisma.platformSupportAgent.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.log(`  Super admin ${email} supprimé.`);
  return 1;
}
