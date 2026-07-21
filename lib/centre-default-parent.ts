import { createOrganizationMemberAction } from "@/app/admin/organizations/[organizationId]/members/actions";
import { isCentreFormationBranch } from "@/lib/branch-capabilities";
import { formatSchoolAddress } from "@/lib/reports/resolve-school-branding";
import { prisma } from "@/lib/prisma";

const SYSTEM_PARENT_NAME = "Parent";
const SYSTEM_PARENT_POSTNOM = "Systeme";
const SYSTEM_PARENT_PRENOM = "Centre";

export function buildCentreSystemParentEmail(branchId: string) {
  return `parent-systeme+${branchId}@centre.klambocore.local`;
}

export function buildCentreSystemParentUsername(branchId: string) {
  const slug = branchId.replace(/[^a-zA-Z0-9]/g, "").slice(-16);
  return `parent.systeme.${slug || "centre"}`;
}

type CentreBranchAddressInput = {
  branchName?: string | null;
  adresse?: string | null;
  commune?: string | null;
  ville?: string | null;
  province?: string | null;
  pays?: string | null;
};

export function buildCentreSystemParentAddress(
  branch: CentreBranchAddressInput,
): string {
  const formattedAddress = formatSchoolAddress(branch);
  if (formattedAddress) return formattedAddress;

  const branchName = branch.branchName?.trim();
  if (branchName) return branchName;

  return "Centre de formation";
}

async function syncCentreSystemParentAddress(params: {
  branchId: string;
  organizationId: string;
  address: string;
}) {
  const email = buildCentreSystemParentEmail(params.branchId).toLowerCase();
  const user = await prisma.user.findFirst({
    where: {
      email,
      members: { some: { organizationId: params.organizationId } },
    },
    select: { id: true, address: true },
  });

  if (!user || user.address?.trim() === params.address.trim()) {
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { address: params.address },
  });
}

async function findCentreSystemParentId(
  branchId: string,
  organizationId: string,
): Promise<string | null> {
  const email = buildCentreSystemParentEmail(branchId).toLowerCase();

  const parent = await prisma.parent.findFirst({
    where: {
      branchMember: {
        branchId,
        member: {
          organizationId,
          user: { email },
        },
      },
    },
    select: { id: true },
  });

  return parent?.id ?? null;
}

/**
 * Parent technique unique par branche centre de formation.
 * Tous les apprenants y sont rattaches sans saisie utilisateur.
 */
export async function ensureCentreDefaultParent(params: {
  branchId: string;
  organizationId: string;
  branchName?: string | null;
}): Promise<string> {
  const branch = await prisma.branch.findUnique({
    where: { id: params.branchId },
    select: {
      typebranch: true,
      name: true,
      adresse: true,
      commune: true,
      ville: true,
      province: true,
      pays: true,
    },
  });

  if (!isCentreFormationBranch(branch?.typebranch)) {
    throw new Error("Parent systeme reserve aux centres de formation.");
  }

  const parentAddress = buildCentreSystemParentAddress({
    branchName: params.branchName ?? branch?.name,
    adresse: branch?.adresse,
    commune: branch?.commune,
    ville: branch?.ville,
    province: branch?.province,
    pays: branch?.pays,
  });

  const existing = await findCentreSystemParentId(
    params.branchId,
    params.organizationId,
  );
  if (existing) {
    await syncCentreSystemParentAddress({
      branchId: params.branchId,
      organizationId: params.organizationId,
      address: parentAddress,
    });
    return existing;
  }

  const email = buildCentreSystemParentEmail(params.branchId).toLowerCase();
  const username = buildCentreSystemParentUsername(params.branchId);

  const created = await createOrganizationMemberAction({
    name: SYSTEM_PARENT_NAME,
    postnom: SYSTEM_PARENT_POSTNOM,
    prenom: SYSTEM_PARENT_PRENOM,
    email,
    telephone: "+243000000001",
    sexe: "masculin",
    address: parentAddress,
    organizationId: params.organizationId,
    branchId: params.branchId,
    orgRole: "parent",
  });

  if (!created.ok) {
    const retry = await findCentreSystemParentId(
      params.branchId,
      params.organizationId,
    );
    if (retry) return retry;
    throw new Error(created.message);
  }

  await prisma.user.update({
    where: { id: created.userId },
    data: { username, statusUser: false },
  });

  const existingBranchMember = await prisma.branchMember.findFirst({
    where: {
      branchId: params.branchId,
      memberId: created.memberId,
    },
    select: { id: true, parent: { select: { id: true } } },
  });

  if (existingBranchMember?.parent?.id) {
    return existingBranchMember.parent.id;
  }

  const branchMember =
    existingBranchMember ??
    (await prisma.branchMember.create({
      data: {
        branchId: params.branchId,
        memberId: created.memberId,
        role: "PARENT",
      },
    }));

  const parent = await prisma.parent.upsert({
    where: { branchMemberId: branchMember.id },
    update: {},
    create: { branchMemberId: branchMember.id },
    select: { id: true },
  });

  return parent.id;
}

export async function resolveStudentParentId(params: {
  typebranch: unknown;
  branchId: string;
  organizationId: string;
  branchName?: string | null;
  requestedParentId?: string | null;
}): Promise<string> {
  if (isCentreFormationBranch(params.typebranch)) {
    return ensureCentreDefaultParent({
      branchId: params.branchId,
      organizationId: params.organizationId,
      branchName: params.branchName,
    });
  }

  const parentId = params.requestedParentId?.trim();
  if (!parentId) {
    throw new Error("Parent obligatoire pour creer un apprenant.");
  }

  return parentId;
}
