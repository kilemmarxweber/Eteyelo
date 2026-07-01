import { BranchRole } from "@/prisma/generated/prisma/client";
import { prisma as Prisma } from "@/lib/prisma";
import { ensureSeedMember } from "./seedContext";

export async function initTeachers() {
  console.log("Initialisation des enseignants...");

  const teacherUsers = await Prisma.user.findMany({
    where: {
      username: {
        startsWith: "prof.",
      },
    },
  });

  let createdCount = 0;

  for (const user of teacherUsers) {
    const { branchMember } = await ensureSeedMember(
      user.id,
      "teacher",
      BranchRole.TEACHER,
    );

    const existingTeacher = await Prisma.teacher.findFirst({
      where: { branchMemberId: branchMember.id },
    });

    if (!existingTeacher) {
      await Prisma.teacher.create({
        data: {
          branchMemberId: branchMember.id,
        },
      });
      createdCount++;
    }
  }

  console.log(`OK ${createdCount} enseignants crees`);
}

export async function clearTeachers() {
  console.log("Suppression des enseignants...");
  await Prisma.teacher.deleteMany({});
  console.log("OK enseignants supprimes");
}
