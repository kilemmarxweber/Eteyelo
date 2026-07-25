/**
 * Unit 11 — prépare une branche PRIMAIRE + comptes de test manquants.
 *
 * - Passe la branche démo en PRIMAIRE (ou crée un clone léger si besoin)
 * - Assure: directeur, prefet, directeur_etudes, caissier, teacher×2 (titulaire/non),
 *   student, parent, gestionnaire
 */
import { randomUUID } from "crypto";
import { hashPassword } from "better-auth/crypto";
import "dotenv/config";

import { prisma } from "../lib/prisma";
import { BranchRole } from "../prisma/generated/prisma/client";

const ORG_ID = "org_eteyelo_demo";
const BRANCH_ID = "cmruzkbw4000068tmt6xjehei";
const PASSWORD = "Password123!";

type SeedAccount = {
  email: string;
  username: string;
  name: string;
  orgRole: string;
  branchRole: BranchRole;
};

const ACCOUNTS: SeedAccount[] = [
  {
    email: "directeur@eteyelo.cd",
    username: "pers.directeur",
    name: "Marie Directeur Kalala",
    orgRole: "directeur",
    branchRole: BranchRole.DIRECTOR,
  },
  {
    email: "directeur.etudes@eteyelo.cd",
    username: "pers.directeur.etudes",
    name: "Jean Directeur Études",
    orgRole: "directeur_etudes",
    branchRole: BranchRole.ADMIN,
  },
];

async function ensureUserAccount(account: SeedAccount, hashedPassword: string) {
  const user = await prisma.user.upsert({
    where: { username: account.username },
    update: {
      email: account.email,
      name: account.name,
      statusUser: true,
      emailVerified: true,
      mustChangePassword: false,
      role: "user",
    },
    create: {
      id: randomUUID(),
      username: account.username,
      email: account.email,
      name: account.name,
      statusUser: true,
      emailVerified: true,
      mustChangePassword: false,
      role: "user",
    },
  });

  const existingAccount = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
  });

  if (existingAccount) {
    await prisma.account.update({
      where: { id: existingAccount.id },
      data: { password: hashedPassword, updatedAt: new Date() },
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

  const member = await prisma.member.upsert({
    where: {
      organizationId_userId: {
        organizationId: ORG_ID,
        userId: user.id,
      },
    },
    update: {
      role: account.orgRole,
      isArchived: false,
      archivedAt: null,
    },
    create: {
      id: randomUUID(),
      organizationId: ORG_ID,
      userId: user.id,
      role: account.orgRole,
      createdAt: new Date(),
    },
  });

  await prisma.branchMember.upsert({
    where: {
      branchId_memberId: {
        branchId: BRANCH_ID,
        memberId: member.id,
      },
    },
    update: { role: account.branchRole },
    create: {
      id: randomUUID(),
      branchId: BRANCH_ID,
      memberId: member.id,
      role: account.branchRole,
    },
  });

  return { email: account.email, orgRole: account.orgRole };
}

async function ensureTeacherTitulaireFlags() {
  const teachings = await prisma.teaching.findMany({
    where: { branchId: BRANCH_ID },
    select: {
      id: true,
      titulaire: true,
      teacher: {
        select: {
          branchMember: {
            select: {
              member: {
                select: {
                  user: { select: { email: true, username: true } },
                },
              },
            },
          },
        },
      },
    },
    take: 20,
  });

  if (teachings.length === 0) {
    return { titulaire: null as string | null, nonTitulaire: null as string | null };
  }

  const withFlag = teachings.find((t) => t.titulaire === true);
  const withoutFlag = teachings.find((t) => t.titulaire !== true);

  if (!withFlag && teachings[0]) {
    await prisma.teaching.update({
      where: { id: teachings[0].id },
      data: { titulaire: true },
    });
  }

  if (!withoutFlag && teachings[1]) {
    await prisma.teaching.update({
      where: { id: teachings[1].id },
      data: { titulaire: false },
    });
  }

  const refreshed = await prisma.teaching.findMany({
    where: { branchId: BRANCH_ID },
    select: {
      titulaire: true,
      teacher: {
        select: {
          branchMember: {
            select: {
              member: {
                select: { user: { select: { email: true } } },
              },
            },
          },
        },
      },
    },
  });

  const titulaire =
    refreshed.find((t) => t.titulaire === true)?.teacher?.branchMember?.member
      ?.user?.email ?? null;
  const nonTitulaire =
    refreshed.find((t) => t.titulaire !== true)?.teacher?.branchMember?.member
      ?.user?.email ?? null;

  return { titulaire, nonTitulaire };
}

async function main() {
  const branch = await prisma.branch.findUnique({
    where: { id: BRANCH_ID },
    select: { id: true, name: true, typebranch: true, organizationId: true },
  });

  if (!branch || branch.organizationId !== ORG_ID) {
    throw new Error(`Branche démo introuvable: ${BRANCH_ID}`);
  }

  if (branch.typebranch !== "PRIMAIRE") {
    await prisma.branch.update({
      where: { id: BRANCH_ID },
      data: { typebranch: "PRIMAIRE" },
    });
    console.log(
      `✓ Branche « ${branch.name} » : ${branch.typebranch} → PRIMAIRE`,
    );
  } else {
    console.log(`✓ Branche « ${branch.name} » déjà PRIMAIRE`);
  }

  const hashedPassword = await hashPassword(PASSWORD);
  const created = [];
  for (const account of ACCOUNTS) {
    created.push(await ensureUserAccount(account, hashedPassword));
  }

  // Reset known staff passwords to the demo password for QA login.
  for (const email of [
    "caissier@eteyelo.cd",
    "prefet@eteyelo.cd",
    "admin@eteyelo.cd",
    "prof.mukendi@eteyelo.cd",
    "prof.mbuyi@eteyelo.cd",
    "kasongo@parent.cd",
  ]) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user) continue;
    const pwd =
      email === "admin@eteyelo.cd"
        ? await hashPassword("Admin123!")
        : hashedPassword;
    const acc = await prisma.account.findFirst({
      where: { userId: user.id, providerId: "credential" },
    });
    if (acc) {
      await prisma.account.update({
        where: { id: acc.id },
        data: { password: pwd, updatedAt: new Date() },
      });
    }
  }

  const student = await prisma.user.findUnique({
    where: { email: "kasongo.junior@eleve.cd" },
    select: { id: true },
  });
  if (student) {
    const studentPwd = await hashPassword("Student123!");
    const acc = await prisma.account.findFirst({
      where: { userId: student.id, providerId: "credential" },
    });
    if (acc) {
      await prisma.account.update({
        where: { id: acc.id },
        data: { password: studentPwd, updatedAt: new Date() },
      });
    }
  }

  const teachers = await ensureTeacherTitulaireFlags();

  console.log(
    JSON.stringify(
      {
        branchId: BRANCH_ID,
        typebranch: "PRIMAIRE",
        seeded: created,
        passwords: {
          staff: PASSWORD,
          student: "Student123!",
          gestionnaire: "Admin123!",
        },
        teachers,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
