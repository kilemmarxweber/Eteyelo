/**
 * Crée (ou met à jour) un utilisateur admin rattaché à une organisation existante.
 *
 * Usage:
 *   pnpm seed:org-admin
 *   pnpm seed:org-admin -- --org=mon-slug
 *   pnpm seed:org-admin -- --org=org_xxx --email=admin@exemple.cd --password=Admin123!
 *
 * Variables d'environnement (optionnelles, mêmes clés) :
 *   SEED_ORG_SLUG | SEED_ORG_ID
 *   SEED_ADMIN_EMAIL | SEED_ADMIN_USERNAME | SEED_ADMIN_PASSWORD
 */
import { randomUUID } from "crypto";
import { hashPassword } from "better-auth/crypto";
import { BranchRole } from "@/prisma/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { APP_ROLE, ORG_ROLE } from "@/lib/permissions";

const DEFAULTS = {
  email: "admin@eteyelo.cd",
  username: "admin",
  password: "Admin123!",
  name: "Admin Organisation",
  prenom: "Admin",
  postnom: "Organisation",
} as const;

function parseArgs(argv: string[]) {
  const flags = new Map<string, string>();
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    flags.set(key, rest.join("=") || "true");
  }
  return flags;
}

async function resolveOrganization(orgRef: string | undefined) {
  const organizations = await prisma.organization.findMany({
    where: { isArchived: false },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });

  if (organizations.length === 0) {
    throw new Error(
      "Aucune organisation en base. Créez-en une avant de lancer ce seed.",
    );
  }

  if (orgRef) {
    const match = organizations.find(
      (org) => org.slug === orgRef || org.id === orgRef,
    );
    if (!match) {
      console.error("Organisations disponibles :");
      for (const org of organizations) {
        console.error(`  - ${org.name}  slug=${org.slug}  id=${org.id}`);
      }
      throw new Error(`Organisation introuvable: ${orgRef}`);
    }
    return match;
  }

  if (organizations.length === 1) {
    return organizations[0]!;
  }

  console.log("Plusieurs organisations trouvées — utilisez --org=<slug|id> :");
  for (const org of organizations) {
    console.log(`  - ${org.name}  slug=${org.slug}  id=${org.id}`);
  }
  throw new Error("Précisez l'organisation avec --org=<slug|id>.");
}

async function ensureUniqueUsername(desired: string, excludeUserId?: string) {
  const taken = await prisma.user.findFirst({
    where: {
      username: desired,
      ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
    },
    select: { id: true },
  });
  if (!taken) return desired;

  const base = desired.slice(0, 40);
  for (let i = 2; i <= 50; i++) {
    const candidate = `${base}${i}`;
    const exists = await prisma.user.findFirst({
      where: {
        username: candidate,
        ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
      },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  return `${base}-${randomUUID().slice(0, 8)}`;
}

async function ensureCredentialUser(input: {
  email: string;
  username: string;
  password: string;
  name: string;
  prenom: string;
  postnom: string;
}) {
  const hashedPassword = await hashPassword(input.password);

  const existingByEmail = await prisma.user.findUnique({
    where: { email: input.email },
  });
  const existingByUsername = await prisma.user.findFirst({
    where: { username: input.username },
  });

  // Même personne via username mais autre email → on met à jour ce compte.
  // Nouvel email + username déjà pris par quelqu'un d'autre → username dérivé.
  let user =
    existingByEmail ??
    (existingByUsername &&
    (!existingByUsername.email ||
      existingByUsername.email === input.email)
      ? existingByUsername
      : null);

  if (user) {
    const username = await ensureUniqueUsername(input.username, user.id);
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        email: input.email,
        username,
        name: input.name,
        prenom: input.prenom,
        postnom: input.postnom,
        role: APP_ROLE.ADMIN,
        emailVerified: true,
        statusUser: true,
        mustChangePassword: false,
        banned: false,
      },
    });
  } else {
    const username = await ensureUniqueUsername(input.username);
    if (username !== input.username) {
      console.log(
        `  Username "${input.username}" déjà pris → utilisation de "${username}"`,
      );
    }
    user = await prisma.user.create({
      data: {
        username,
        email: input.email,
        name: input.name,
        prenom: input.prenom,
        postnom: input.postnom,
        role: APP_ROLE.ADMIN,
        emailVerified: true,
        statusUser: true,
        mustChangePassword: false,
      },
    });
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

async function linkToOrganization(userId: string, organizationId: string) {
  const member = await prisma.member.upsert({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    update: { role: ORG_ROLE.GESTIONNAIRE },
    create: {
      id: randomUUID(),
      organizationId,
      userId,
      role: ORG_ROLE.GESTIONNAIRE,
      createdAt: new Date(),
    },
  });

  const branch = await prisma.branch.findFirst({
    where: { organizationId, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, code: true },
  });

  if (!branch) {
    return { member, branch: null, branchMember: null };
  }

  const branchMember = await prisma.branchMember.upsert({
    where: {
      branchId_memberId: {
        branchId: branch.id,
        memberId: member.id,
      },
    },
    update: { role: BranchRole.ADMIN },
    create: {
      branchId: branch.id,
      memberId: member.id,
      role: BranchRole.ADMIN,
    },
  });

  return { member, branch, branchMember };
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));

  const orgRef =
    flags.get("org") ??
    process.env.SEED_ORG_SLUG ??
    process.env.SEED_ORG_ID;

  const email =
    flags.get("email") ?? process.env.SEED_ADMIN_EMAIL ?? DEFAULTS.email;
  const explicitUsername =
    flags.get("username") ?? process.env.SEED_ADMIN_USERNAME;
  const username =
    explicitUsername ??
    (email !== DEFAULTS.email
      ? email.split("@")[0]!.replace(/[^a-zA-Z0-9._-]/g, ".")
      : DEFAULTS.username);
  const password =
    flags.get("password") ??
    process.env.SEED_ADMIN_PASSWORD ??
    DEFAULTS.password;

  console.log("Création d'un admin pour une organisation existante...\n");

  const organization = await resolveOrganization(orgRef);
  console.log(
    `Organisation: ${organization.name} (${organization.slug})`,
  );

  const user = await ensureCredentialUser({
    email,
    username,
    password,
    name: DEFAULTS.name,
    prenom: DEFAULTS.prenom,
    postnom: DEFAULTS.postnom,
  });

  const { member, branch } = await linkToOrganization(
    user.id,
    organization.id,
  );

  console.log("\nAdmin prêt :");
  console.log("=".repeat(56));
  console.log(`  Email        : ${user.email}`);
  console.log(`  Username     : ${user.username}`);
  console.log(`  Mot de passe : ${password}`);
  console.log(`  User.role    : ${APP_ROLE.ADMIN}`);
  console.log(`  Member.role  : ${member.role}`);
  console.log(`  Organisation : /admin/organizations/${organization.id}`);
  if (branch) {
    console.log(`  Branche      : ${branch.name} (${branch.code})`);
  } else {
    console.log("  Branche      : (aucune — membership org seul)");
  }
  console.log("=".repeat(56));
}

main()
  .catch((error) => {
    console.error("\nÉchec du seed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
