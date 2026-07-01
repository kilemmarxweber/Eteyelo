import { randomUUID } from "crypto";
import { BranchRole } from "@/prisma/generated/prisma/client";
import { prisma as Prisma } from "@/lib/prisma";

export const SEED_ORGANIZATION_SLUG = "eteyelo-demo";
export const SEED_ORGANIZATION_ID = "org_eteyelo_demo";
export const SEED_BRANCH_CODE = "KIN-CENTRE";

export async function ensureSeedOrganization() {
  return Prisma.organization.upsert({
    where: { slug: SEED_ORGANIZATION_SLUG },
    update: {
      name: "Eteyelo Demo",
      metadata: JSON.stringify({ seed: true }),
    },
    create: {
      id: SEED_ORGANIZATION_ID,
      name: "Eteyelo Demo",
      slug: SEED_ORGANIZATION_SLUG,
      logo: null,
      createdAt: new Date(),
      metadata: JSON.stringify({ seed: true }),
    },
  });
}

export async function ensureSeedBranch() {
  const organization = await ensureSeedOrganization();

  const existingBranch = await Prisma.branch.findFirst({
    where: {
      organizationId: organization.id,
      code: SEED_BRANCH_CODE,
    },
  });

  if (existingBranch) return existingBranch;

  return Prisma.branch.create({
    data: {
      name: "Kinshasa Centre",
      code: SEED_BRANCH_CODE,
      latitude: -4.325,
      longitude: 15.322,
      attendanceRadius: 100,
      organizationId: organization.id,
      isActive: true,
    },
  });
}

export async function getSeedBranchId() {
  const branch = await ensureSeedBranch();
  return branch.id;
}

export async function ensureSeedMember(
  userId: string,
  organizationRole: string,
  branchRole: BranchRole,
) {
  const organization = await ensureSeedOrganization();
  const branch = await ensureSeedBranch();

  const existingMember = await Prisma.member.findFirst({
    where: {
      organizationId: organization.id,
      userId,
    },
  });

  const member = existingMember
    ? await Prisma.member.update({
        where: { id: existingMember.id },
        data: { role: organizationRole },
      })
    : await Prisma.member.create({
        data: {
          id: randomUUID(),
          organizationId: organization.id,
          userId,
          role: organizationRole,
          createdAt: new Date(),
        },
      });

  const branchMember = await Prisma.branchMember.upsert({
    where: {
      branchId_memberId: {
        branchId: branch.id,
        memberId: member.id,
      },
    },
    update: { role: branchRole },
    create: {
      branchId: branch.id,
      memberId: member.id,
      role: branchRole,
    },
  });

  return { organization, branch, member, branchMember };
}
