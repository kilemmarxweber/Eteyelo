import { prisma } from "@/lib/prisma";
import { APP_ROLE } from "@/lib/permissions";
import { randomUUID } from "crypto";
import { hashPassword } from "better-auth/crypto";

const DEFAULT_PASSWORD = "Support123!";

const PLATFORM_SUPPORT_SEED = [
  {
    username: "support.klambocore",
    email: "support@klambocore.cd",
    name: "Support Klambocore",
    prenom: "Support",
    postnom: "Klambocore",
    displayTitle: "Agent support plateforme",
    specialties: ["Incidents", "Escalades", "Configuration"],
    image: null as string | null,
    isLead: true,
    sortOrder: 0,
  },
  {
    username: "kilem.maxweber",
    email: "kilemmarxweber@gmail.com",
    name: "Kilem Maxweber",
    prenom: "Kilem",
    postnom: "Maxweber",
    displayTitle: "Responsable support technique",
    specialties: ["Comptes et acces", "Incidents techniques", "Configuration"],
    image:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&h=400&q=80",
    isLead: false,
    sortOrder: 1,
  },
  {
    username: "chris.agasa",
    email: "agasacoding@gmail.com",
    name: "Chris AGASA",
    prenom: "Chris",
    postnom: "AGASA",
    displayTitle: "Ingenieur support & developpement",
    specialties: [
      "Etablissements",
      "Paiements & bulletins",
      "Integrations",
    ],
    image:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&h=400&q=80",
    isLead: false,
    sortOrder: 2,
  },
] as const;

async function ensurePlatformSupportUser(
  entry: (typeof PLATFORM_SUPPORT_SEED)[number],
) {
  const hashedPassword = await hashPassword(DEFAULT_PASSWORD);

  const user = await prisma.user.upsert({
    where: { email: entry.email },
    update: {
      username: entry.username,
      name: entry.name,
      prenom: entry.prenom,
      postnom: entry.postnom,
      role: APP_ROLE.PLATFORM_SUPPORT,
      emailVerified: true,
    },
    create: {
      username: entry.username,
      email: entry.email,
      name: entry.name,
      prenom: entry.prenom,
      postnom: entry.postnom,
      role: APP_ROLE.PLATFORM_SUPPORT,
      emailVerified: true,
      statusUser: true,
    },
  });

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
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  if (entry.email === "support@klambocore.cd") {
    await prisma.member.deleteMany({
      where: { userId: user.id },
    });
  }

  return user;
}

export async function initPlatformSupport() {
  console.log("Initialisation du support plateforme Klambocore...");

  let created = 0;

  for (const entry of PLATFORM_SUPPORT_SEED) {
    const user = await ensurePlatformSupportUser(entry);

    const existing = await prisma.platformSupportAgent.findUnique({
      where: { userId: user.id },
    });

    if (existing) {
      await prisma.platformSupportAgent.update({
        where: { id: existing.id },
        data: {
          displayTitle: entry.displayTitle,
          specialties: [...entry.specialties],
          image: entry.image,
          isLead: entry.isLead,
          sortOrder: entry.sortOrder,
          isActive: true,
        },
      });
      console.log(`  ↻ ${entry.name} mis a jour`);
      continue;
    }

    await prisma.platformSupportAgent.create({
      data: {
        userId: user.id,
        displayTitle: entry.displayTitle,
        specialties: [...entry.specialties],
        image: entry.image,
        isLead: entry.isLead,
        sortOrder: entry.sortOrder,
      },
    });

    created += 1;
    console.log(`  ✓ ${entry.name} cree`);
  }

  console.log(`OK ${created} agent(s) support plateforme cree(s)`);
}

export async function clearPlatformSupport() {
  console.log("Suppression des agents support plateforme...");
  await prisma.platformSupportEscalation.deleteMany();
  await prisma.platformSupportAgent.deleteMany();
  console.log("OK support plateforme supprime");
}
