import { BranchRole } from "@/prisma/generated/prisma/client";
import { prisma as Prisma } from "@/lib/prisma";
import { ensureSeedMember, getSeedBranchId } from "./seedContext";

export async function initParents() {
  console.log("Initialisation des parents...");
  const branchId = await getSeedBranchId();

  const parentUsers = await Prisma.user.findMany({
    where: {
      username: {
        startsWith: "parent.",
      },
    },
  });

  let createdCount = 0;

  for (const user of parentUsers) {
    const { branchMember } = await ensureSeedMember(
      user.id,
      "parent",
      BranchRole.PARENT,
    );

    const existingParent = await Prisma.parent.findFirst({
      where: { branchMemberId: branchMember.id },
    });

    const parent =
      existingParent ??
      (await Prisma.parent.create({
        data: {
          branchMemberId: branchMember.id,
        },
      }));

    if (!existingParent) createdCount++;

    const existingDiscount = await Prisma.discountRule.findFirst({
      where: {
        scope: "PARENT",
        parentId: parent.id,
        branchId,
      },
    });

    if (!existingDiscount) {
      await Prisma.discountRule.create({
        data: {
          scope: "PARENT",
          parentId: parent.id,
          percentage: 10,
          branchId,
        },
      });
    }
  }

  console.log(`OK ${createdCount} parents crees`);
}

export async function clearParents() {
  console.log("Suppression des parents...");
  await Prisma.parent.deleteMany({});
  console.log("OK parents supprimes");
}
