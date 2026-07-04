/**
 * Seed dédié : 2 agents support plateforme Klambocore + 2 agents support par organisation.
 * Usage: npx tsx prisma/seeds/seedSupportAgents.ts
 */
import { randomUUID } from "crypto";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/prisma";
import { APP_ROLE, ORG_ROLE } from "@/lib/permissions";

const DEFAULT_PASSWORD = "Support123!";

const PLATFORM_SUPPORT_USERS = [
  {
    username: "kilem.maxweber",
    email: "kilemmarxweber@gmail.com",
    prenom: "Kilem",
    postnom: "Maxweber",
    nom: "Maxweber",
    name: "Kilem Maxweber",
    displayTitle: "Responsable support technique",
    specialties: ["Comptes et accès", "Incidents techniques", "Configuration"],
    image:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&h=400&q=80",
    isLead: true,
    sortOrder: 0,
  },
  {
    username: "chris.agasa",
    email: "agasacoding@gmail.com",
    prenom: "Chris",
    postnom: "AGASA",
    nom: "AGASA",
    name: "Chris AGASA",
    displayTitle: "Ingénieur support & développement",
    specialties: ["Établissements", "Paiements & bulletins", "Intégrations"],
    image:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&h=400&q=80",
    isLead: false,
    sortOrder: 1,
  },
] as const;

const ORG_SUPPORT_TEMPLATES = [
  {
    key: "accueil",
    prenom: "Marie",
    postnom: "Kabeya",
    nom: "Support",
    displayTitle: "Support accueil & comptes",
    specialties: ["Comptes parents", "Accès utilisateurs", "FAQ"],
    isPrimary: true,
  },
  {
    key: "technique",
    prenom: "Patrick",
    postnom: "Ilunga",
    nom: "Support",
    displayTitle: "Support technique établissement",
    specialties: ["Paiements", "Bulletins", "Incidents"],
    isPrimary: false,
  },
] as const;

async function ensureCredentialUser(input: {
  username: string;
  email: string;
  name: string;
  prenom?: string;
  postnom?: string;
  nom?: string;
  role?: string;
  password?: string;
}) {
  const hashedPassword = await hashPassword(input.password ?? DEFAULT_PASSWORD);

  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: {
      username: input.username,
      name: input.name,
      prenom: input.prenom,
      postnom: input.postnom,
      role: input.role,
      emailVerified: true,
    },
    create: {
      username: input.username,
      email: input.email,
      name: input.name,
      prenom: input.prenom,
      postnom: input.postnom,
      role: input.role ?? "user",
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

  return user;
}

async function seedPlatformSupport() {
  console.log("\n📞 Support plateforme Klambocore...");

  for (const entry of PLATFORM_SUPPORT_USERS) {
    const user = await ensureCredentialUser({
      username: entry.username,
      email: entry.email,
      name: entry.name,
      prenom: entry.prenom,
      postnom: entry.postnom,
      role: APP_ROLE.PLATFORM_SUPPORT,
    });

    await prisma.platformSupportAgent.upsert({
      where: { userId: user.id },
      update: {
        displayTitle: entry.displayTitle,
        specialties: [...entry.specialties],
        image: entry.image,
        isLead: entry.isLead,
        sortOrder: entry.sortOrder,
        isActive: true,
      },
      create: {
        userId: user.id,
        displayTitle: entry.displayTitle,
        specialties: [...entry.specialties],
        image: entry.image,
        isLead: entry.isLead,
        sortOrder: entry.sortOrder,
        isActive: true,
      },
    });

    console.log(`  ✓ ${entry.name} <${entry.email}>`);
  }
}

async function seedOrganizationSupport() {
  console.log("\n🏫 Support par organisation...");

  const organizations = await prisma.organization.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });

  if (organizations.length === 0) {
    console.log("  ⚠ Aucune organisation en base.");
    return;
  }

  let totalAgents = 0;

  for (const org of organizations) {
    console.log(`\n  Organisation: ${org.name} (${org.slug})`);

    for (const template of ORG_SUPPORT_TEMPLATES) {
      const email = `support.${template.key}.${org.slug}@eteyelo.seed`;
      const username = `support.${template.key}.${org.slug}`;
      const name = `${template.prenom} ${template.postnom} ${template.nom}`;

      const user = await ensureCredentialUser({
        username,
        email,
        name,
        prenom: template.prenom,
        postnom: template.postnom,
        role: "user",
      });

      const member = await prisma.member.upsert({
        where: {
          organizationId_userId: {
            organizationId: org.id,
            userId: user.id,
          },
        },
        update: { role: ORG_ROLE.SUPPORT },
        create: {
          id: randomUUID(),
          organizationId: org.id,
          userId: user.id,
          role: ORG_ROLE.SUPPORT,
          createdAt: new Date(),
        },
      });

      const existingAgent = await prisma.organizationSupportAgent.findUnique({
        where: { memberId: member.id },
      });

      if (existingAgent) {
        await prisma.organizationSupportAgent.update({
          where: { id: existingAgent.id },
          data: {
            displayTitle: template.displayTitle,
            specialties: [...template.specialties],
            isPrimary: template.isPrimary,
            isActive: true,
          },
        });

        const scopeCount = await prisma.organizationSupportBranchScope.count({
          where: { supportId: existingAgent.id },
        });

        if (scopeCount === 0) {
          await prisma.organizationSupportBranchScope.create({
            data: { supportId: existingAgent.id, branchId: null },
          });
        }
      } else {
        const agent = await prisma.organizationSupportAgent.create({
          data: {
            memberId: member.id,
            organizationId: org.id,
            displayTitle: template.displayTitle,
            specialties: [...template.specialties],
            isPrimary: template.isPrimary,
            isActive: true,
            branchScopes: {
              create: [{ branchId: null }],
            },
          },
        });
        void agent;
      }

      totalAgents += 1;
      console.log(`    ✓ ${name} <${email}>`);
    }
  }

  console.log(`\n  Total: ${totalAgents} agent(s) organisation sur ${organizations.length} org(s)`);
}

async function main() {
  console.log("🌱 Seed agents support (plateforme + organisations)...");

  await seedPlatformSupport();
  await seedOrganizationSupport();

  console.log("\n✅ Seed support terminé.");
  console.log(`   Mot de passe par défaut des comptes créés: ${DEFAULT_PASSWORD}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Erreur seed support:", error);
    process.exit(1);
  });
