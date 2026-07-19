import "dotenv/config";
import { prisma } from "@/lib/prisma";

const KILEM_IMAGE = "/uploads/kilem.jpeg";
const DISPLAY_TITLE = "Support Klambocore";
const BIO =
  "Yannick Kilem — support plateforme Klambocore pour les établissements Eteyelo.";
const SPECIALTIES = [
  "Plateforme",
  "Comptes & accès",
  "Paiements",
  "Escalades",
];

function resolveSuperAdminEmail() {
  const email = process.env.SMTP_USER?.trim();
  if (!email) {
    throw new Error(
      "SMTP_USER manquant dans .env — requis pour le seed support Klambocore.",
    );
  }
  return email.toLowerCase();
}

/**
 * Agent support plateforme Klambocore = le même user que le super admin (SMTP_USER).
 */
export async function seedKlambocoreSupport() {
  console.log("Initialisation du support Klambocore...");

  const email = resolveSuperAdminEmail();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, prenom: true },
  });

  if (!user) {
    throw new Error(
      `Super admin introuvable (${email}). Lancez d'abord le seed superAdmin.`,
    );
  }

  const agent = await prisma.platformSupportAgent.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      displayTitle: DISPLAY_TITLE,
      bio: BIO,
      specialties: SPECIALTIES,
      image: KILEM_IMAGE,
      isActive: true,
      isLead: true,
      sortOrder: 0,
    },
    update: {
      displayTitle: DISPLAY_TITLE,
      bio: BIO,
      specialties: SPECIALTIES,
      image: KILEM_IMAGE,
      isActive: true,
      isLead: true,
      sortOrder: 0,
    },
  });

  console.log(
    `OK support Klambocore — ${user.prenom ?? ""} ${user.name} (${user.email}), photo kilem`,
  );
  return agent;
}

export async function clearKlambocoreSupport() {
  console.log("Suppression du support Klambocore...");
  const email = process.env.SMTP_USER?.trim()?.toLowerCase();
  if (!email) {
    console.warn("SMTP_USER absent — clear support ignoré.");
    return 0;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) {
    console.log("  Aucun agent support à supprimer.");
    return 0;
  }

  const result = await prisma.platformSupportAgent.deleteMany({
    where: { userId: user.id },
  });
  console.log(`  ${result.count} agent(s) support Klambocore supprimé(s)`);
  return result.count;
}
