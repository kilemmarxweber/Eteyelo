import { BranchRole, StudentCategory } from "@/prisma/generated/prisma/client";
import { prisma as Prisma } from "@/lib/prisma";
import { ensureSeedMember, getSeedBranchId } from "./seedContext";

const parentChildRelations = [
  { parentUsername: "parent.kasongo", childUsername: "eleve.kasongo.junior" },
  { parentUsername: "parent.kalombo", childUsername: "eleve.kalombo.grace" },
  { parentUsername: "parent.mulumba", childUsername: "eleve.mulumba.prince" },
  { parentUsername: "parent.mwamba", childUsername: "eleve.mwamba.esther" },
  { parentUsername: "parent.katanga", childUsername: "eleve.katanga.david" },
  { parentUsername: "parent.kasongo", childUsername: "eleve.mukendi.sarah" },
  { parentUsername: "parent.kalombo", childUsername: "eleve.tshiamala.michel" },
  { parentUsername: "parent.mulumba", childUsername: "eleve.kabongo.ruth" },
  { parentUsername: "parent.mwamba", childUsername: "eleve.mputu.samuel" },
  { parentUsername: "parent.katanga", childUsername: "eleve.tshilombo.joie" },
];

function normalizeUsername(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getStudentCategory(username: string): StudentCategory {
  if (username.includes("orphelin")) return StudentCategory.ORPHAN;
  if (username.includes("boursier")) return StudentCategory.SPONSORED;

  if (
    username.includes("mukendi") ||
    username.includes("tshiamala") ||
    username.includes("kabongo") ||
    username.includes("mputu") ||
    username.includes("tshilombo")
  ) {
    return StudentCategory.GROUPE;
  }

  return StudentCategory.NORMAL;
}

export async function initStudents() {
  console.log("Initialisation des etudiants...");
  await getSeedBranchId();

  const studentUsers = await Prisma.user.findMany({
    where: {
      username: { startsWith: "eleve." },
    },
  });

  const parents = await Prisma.parent.findMany({
    include: {
      branchMember: {
        include: {
          member: {
            include: {
              user: true,
            },
          },
        },
      },
    },
  });

  const parentMap = new Map(
    parents.map((p) => [
      normalizeUsername(p.branchMember?.member?.user?.username),
      p.id,
    ]),
  );

  let createdCount = 0;

  for (const user of studentUsers) {
    const username = normalizeUsername(user.username);
    const relation = parentChildRelations.find(
      (r) => r.childUsername === username,
    );
    const parentId = relation ? parentMap.get(relation.parentUsername) : null;

    if (!parentId) {
      console.warn(`Parent introuvable pour ${user.username}`);
      continue;
    }

    const { branchMember } = await ensureSeedMember(
      user.id,
      "student",
      BranchRole.STUDENT,
    );

    const existing = await Prisma.student.findFirst({
      where: { branchMemberId: branchMember.id },
    });

    if (!existing) {
      await Prisma.student.create({
        data: {
          branchMemberId: branchMember.id,
          parentId,
          category: getStudentCategory(username),
        },
      });

      createdCount++;
    }
  }

  console.log(`OK ${createdCount} etudiants crees`);
}

export async function clearStudents() {
  console.log("Suppression des etudiants...");
  await Prisma.student.deleteMany({});
  console.log("OK etudiants supprimes");
}
