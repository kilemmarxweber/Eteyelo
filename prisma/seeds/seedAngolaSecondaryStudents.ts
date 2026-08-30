import { randomUUID } from "crypto";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/prisma";
import { ensureAcademicPeriodsForBranch } from "@/lib/academic-periods";
import { ensureAngolaSecondaryStructure } from "@/lib/angola-secondary-bootstrap";
import { upsertAngolaSecondaryCoursesForBranch } from "@/lib/angola-secondary-catalog-sync";
import { buildClassCode, buildClassName } from "@/lib/class-structure";

const SEED_PASSWORD = "Student123!";
const PARENT_EMAIL = "parent.angola.seed@eteyelo.cd";

const STUDENTS = [
  {
    level: "7ª",
    parallel: "A",
    email: "seed.7a@eleve.cd",
    name: "Manuel",
    prenom: "João",
    postnom: "Santos",
    sexe: "masculin",
  },
  {
    level: "10ª",
    parallel: "A",
    email: "seed.10a@eleve.cd",
    name: "Fernandes",
    prenom: "Maria",
    postnom: "Costa",
    sexe: "feminin",
  },
] as const;

function timeOnDay(hours: number, minutes: number) {
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));
}

async function resolveBranch() {
  const requestedId = process.env.ANGOLA_SEED_BRANCH_ID?.trim();
  if (requestedId) {
    const branch = await prisma.branch.findFirst({
      where: { id: requestedId },
      select: {
        id: true,
        name: true,
        typebranch: true,
        educationSystem: true,
        organizationId: true,
      },
    });
    if (!branch) {
      throw new Error(`Branche introuvable: ${requestedId}`);
    }
    return branch;
  }

  const angola = await prisma.branch.findFirst({
    where: {
      typebranch: "SECONDAIRE",
      educationSystem: "ANGOLAIS",
      isActive: true,
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      typebranch: true,
      educationSystem: true,
      organizationId: true,
    },
  });
  if (angola) return angola;

  throw new Error(
    "Aucune branche secondaire angolaise trouvée. Créez-en une (type Secondaire + enseignement angolais) ou définissez ANGOLA_SEED_BRANCH_ID.",
  );
}

async function ensureSchoolYear(branchId: string) {
  const current = await prisma.schoolYear.findFirst({
    where: { branchId, isCurrentYear: true, isArchived: false },
    select: { id: true, nameYear: true },
  });
  if (current) return current;

  const start = new Date(new Date().getFullYear(), 8, 1);
  const end = new Date(start.getFullYear() + 1, 7, 31);
  const nameYear = `${start.getFullYear()}-${end.getFullYear()}`;

  return prisma.schoolYear.create({
    data: {
      branchId,
      nameYear,
      startYear: start,
      endYear: end,
      isCurrentYear: true,
    },
    select: { id: true, nameYear: true },
  });
}

async function ensureCreneau(branchId: string) {
  const existing = await prisma.creneau.findFirst({
    where: { branchId, isArchived: false },
    select: { id: true },
  });
  if (existing) return existing;

  return prisma.creneau.create({
    data: {
      branchId,
      nameCreneau: "Manhã",
      startTime: timeOnDay(7, 30),
      endTime: timeOnDay(12, 30),
      durationCourse: 45,
      recreationHour: timeOnDay(10, 0),
      recreationDuration: 15,
    },
    select: { id: true },
  });
}

async function ensureCienciasOption(branchId: string, ciclo2SectionId: string) {
  const existing = await prisma.option.findFirst({
    where: {
      branchId,
      OR: [{ codeOption: "CIENCIAS" }, { nameOption: "Ciências" }],
    },
    select: { id: true, nameOption: true, codeOption: true },
  });
  if (existing) {
    await prisma.option.update({
      where: { id: existing.id },
      data: { sectionId: ciclo2SectionId, statusOption: true },
    });
    return existing;
  }

  return prisma.option.create({
    data: {
      branchId,
      sectionId: ciclo2SectionId,
      codeOption: "CIENCIAS",
      nameOption: "Ciências",
      statusOption: true,
    },
    select: { id: true, nameOption: true, codeOption: true },
  });
}

async function ensureClasse(params: {
  branchId: string;
  level: string;
  parallel: string;
  optionId: string;
  optionName: string | null;
  creneauId: string;
  horaireType: "COMPLET" | "REDUIT";
}) {
  const nameClasse = buildClassName({
    typebranch: "SECONDAIRE",
    educationSystem: "ANGOLAIS",
    level: params.level,
    parallel: params.parallel,
    optionName: params.optionName,
  });
  const codeClasse = buildClassCode({
    typebranch: "SECONDAIRE",
    educationSystem: "ANGOLAIS",
    level: params.level,
    parallel: params.parallel,
    optionName: params.optionName,
  });

  const existing = await prisma.classe.findFirst({
    where: {
      branchId: params.branchId,
      OR: [{ nameClasse }, { codeClasse }, { level: params.level, parallel: params.parallel }],
    },
    select: { id: true, nameClasse: true, level: true },
  });
  if (existing) {
    return prisma.classe.update({
      where: { id: existing.id },
      data: {
        nameClasse,
        codeClasse,
        level: params.level,
        parallel: params.parallel,
        optionId: params.optionId,
        creneauId: params.creneauId,
        horaireType: params.horaireType,
        statusClasse: true,
        capacity: existing ? undefined : 40,
      },
      select: { id: true, nameClasse: true, level: true },
    });
  }

  return prisma.classe.create({
    data: {
      branchId: params.branchId,
      nameClasse,
      codeClasse,
      level: params.level,
      parallel: params.parallel,
      optionId: params.optionId,
      creneauId: params.creneauId,
      horaireType: params.horaireType,
      statusClasse: true,
      capacity: 40,
    },
    select: { id: true, nameClasse: true, level: true },
  });
}

async function ensureCredentialUser(params: {
  email: string;
  username: string;
  name: string;
  prenom: string;
  postnom: string;
  sexe: string;
  passwordHash: string;
}) {
  const existing = await prisma.user.findUnique({
    where: { email: params.email },
  });
  const user =
    existing ??
    (await prisma.user.create({
      data: {
        email: params.email,
        username: params.username,
        name: params.name,
        prenom: params.prenom,
        postnom: params.postnom,
        sexe: params.sexe,
        emailVerified: true,
        statusUser: true,
        mustChangePassword: false,
        role: "user",
      },
    }));

  const account = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
  });
  if (account) {
    await prisma.account.update({
      where: { id: account.id },
      data: { password: params.passwordHash, accountId: user.id },
    });
  } else {
    await prisma.account.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: params.passwordHash,
      },
    });
  }

  return user;
}

async function ensureOrgAndBranchMembership(params: {
  userId: string;
  organizationId: string;
  branchId: string;
  orgRole: string;
  branchRole: "PARENT" | "STUDENT";
}) {
  let member = await prisma.member.findUnique({
    where: {
      organizationId_userId: {
        organizationId: params.organizationId,
        userId: params.userId,
      },
    },
    select: { id: true },
  });
  if (!member) {
    member = await prisma.member.create({
      data: {
        id: randomUUID(),
        organizationId: params.organizationId,
        userId: params.userId,
        role: params.orgRole,
        createdAt: new Date(),
      },
      select: { id: true },
    });
  }

  const branchMember = await prisma.branchMember.upsert({
    where: {
      branchId_memberId: {
        branchId: params.branchId,
        memberId: member.id,
      },
    },
    update: { role: params.branchRole },
    create: {
      branchId: params.branchId,
      memberId: member.id,
      role: params.branchRole,
    },
  });

  return branchMember;
}

export async function seedAngolaSecondaryStudents() {
  console.log("Seed élèves Angola (7ª + 10ª)...");

  const branch = await resolveBranch();
  if (branch.typebranch !== "SECONDAIRE") {
    throw new Error(
      `La branche « ${branch.name} » n'est pas secondaire (${branch.typebranch}).`,
    );
  }
  if (branch.educationSystem !== "ANGOLAIS") {
    await prisma.branch.update({
      where: { id: branch.id },
      data: { educationSystem: "ANGOLAIS" },
    });
    console.log(`  Branche « ${branch.name} » passée en enseignement angolais.`);
  } else {
    console.log(`  Branche: ${branch.name}`);
  }

  await ensureAcademicPeriodsForBranch({
    branchId: branch.id,
    typebranch: branch.typebranch,
    educationSystem: "ANGOLAIS",
  });

  const angola = await ensureAngolaSecondaryStructure(prisma, branch.id);
  const courses = await upsertAngolaSecondaryCoursesForBranch(branch.id);
  console.log(
    `  Cours PORTUGUESA: ${courses.coursesCreated} créé(s), ${courses.coursesSkipped} déjà présents`,
  );
  const ciencias = await ensureCienciasOption(branch.id, angola.ciclo2.id);
  const schoolYear = await ensureSchoolYear(branch.id);
  const creneau = await ensureCreneau(branch.id);
  const passwordHash = await hashPassword(SEED_PASSWORD);

  const classe7 = await ensureClasse({
    branchId: branch.id,
    level: "7ª",
    parallel: "A",
    optionId: angola.option.id,
    optionName: null,
    creneauId: creneau.id,
    horaireType: "COMPLET",
  });
  const classe10 = await ensureClasse({
    branchId: branch.id,
    level: "10ª",
    parallel: "A",
    optionId: ciencias.id,
    optionName: ciencias.nameOption,
    creneauId: creneau.id,
    horaireType: "COMPLET",
  });

  const parentUser = await ensureCredentialUser({
    email: PARENT_EMAIL,
    username: "parent.angola.seed",
    name: "Santos",
    prenom: "Pedro",
    postnom: "Manuel",
    sexe: "masculin",
    passwordHash,
  });
  const parentBranchMember = await ensureOrgAndBranchMembership({
    userId: parentUser.id,
    organizationId: branch.organizationId,
    branchId: branch.id,
    orgRole: "parent",
    branchRole: "PARENT",
  });
  const parent =
    (await prisma.parent.findUnique({
      where: { branchMemberId: parentBranchMember.id },
    })) ??
    (await prisma.parent.create({
      data: {
        branchMemberId: parentBranchMember.id,
        profession: "Comerciante",
      },
    }));

  for (const studentSeed of STUDENTS) {
    const classe = studentSeed.level === "7ª" ? classe7 : classe10;
    const user = await ensureCredentialUser({
      email: studentSeed.email,
      username: studentSeed.email.split("@")[0] ?? studentSeed.email,
      name: studentSeed.name,
      prenom: studentSeed.prenom,
      postnom: studentSeed.postnom,
      sexe: studentSeed.sexe,
      passwordHash,
    });
    const studentMember = await ensureOrgAndBranchMembership({
      userId: user.id,
      organizationId: branch.organizationId,
      branchId: branch.id,
      orgRole: "student",
      branchRole: "STUDENT",
    });
    const student =
      (await prisma.student.findUnique({
        where: { branchMemberId: studentMember.id },
      })) ??
      (await prisma.student.create({
        data: {
          branchMemberId: studentMember.id,
          parentId: parent.id,
          statusStudent: true,
          placeOfBirth: "Luanda",
          nationalite: "Angolaise",
        },
      }));

    await prisma.classEnrollment.upsert({
      where: {
        schoolYearId_studentId: {
          schoolYearId: schoolYear.id,
          studentId: student.id,
        },
      },
      update: {
        classeId: classe.id,
        statusEnrollment: true,
        branchId: branch.id,
      },
      create: {
        schoolYearId: schoolYear.id,
        studentId: student.id,
        classeId: classe.id,
        branchId: branch.id,
        statusEnrollment: true,
      },
    });

    console.log(`  ${studentSeed.prenom} ${studentSeed.name} → ${classe.nameClasse} (${classe.level})`);
  }

  console.log(`  Mot de passe: ${SEED_PASSWORD}`);
  console.log(`  Parent: ${PARENT_EMAIL}`);
  console.log(`  7ª: ${STUDENTS[0].email}`);
  console.log(`  10ª: ${STUDENTS[1].email}`);
}

export async function clearAngolaSecondaryStudents() {
  const emails = [PARENT_EMAIL, ...STUDENTS.map((student) => student.email)];
  const users = await prisma.user.findMany({
    where: { email: { in: [...emails] } },
    select: { id: true },
  });
  if (users.length === 0) return;
  await prisma.user.deleteMany({
    where: { id: { in: users.map((user) => user.id) } },
  });
  console.log(`  Comptes seed Angola supprimés: ${users.length}`);
}

if (process.argv[1]?.includes("seedAngolaSecondaryStudents")) {
  seedAngolaSecondaryStudents()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
