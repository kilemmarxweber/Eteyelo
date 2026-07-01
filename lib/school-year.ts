"use server";
import { Prisma } from "@/prisma/generated/prisma/client";
import { prisma } from "@/lib/prisma";
export async function getSchoolYear() {
  return await prisma.schoolYear.findFirst({
    where: { isCurrentYear: true },
  });
}
