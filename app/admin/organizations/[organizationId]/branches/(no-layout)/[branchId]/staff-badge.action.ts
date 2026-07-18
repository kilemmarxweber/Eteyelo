"use server";

import { prisma } from "@/lib/prisma";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { orgRoleLabel } from "@/lib/org-role-labels";
import {
  buildStaffDisplayCode,
  type StaffBadgeData,
  type StaffBadgeKind,
} from "@/lib/staff-badge";
import { getBranchImage } from "@/lib/utils";

function getFullName(user: {
  name: string;
  postnom: string | null;
  prenom: string | null;
}) {
  return [user.name, user.postnom, user.prenom].filter(Boolean).join(" ").trim();
}

export async function getStaffBadgeAction(
  kind: StaffBadgeKind,
  entityId: string,
): Promise<StaffBadgeData | null> {
  const { branchId, organizationId } = await requireBranchContext();

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, organizationId },
    select: { id: true, name: true, image: true },
  });

  if (!branch) return null;

  const branchImages = getBranchImage(branch.image);

  if (kind === "teacher") {
    const teacher = await prisma.teacher.findFirst({
      where: {
        id: entityId,
        branchMember: { branchId, branch: { organizationId } },
      },
      include: {
        branchMember: {
          include: {
            member: {
              include: { user: true },
            },
          },
        },
      },
    });

    const user = teacher?.branchMember?.member?.user;
    if (!teacher || !user) return null;

    const matricule =
      user.username ??
      buildStaffDisplayCode("teacher", teacher.id, branchId);

    return {
      kind: "teacher",
      entityId: teacher.id,
      userId: user.id,
      lastName: user.name,
      postName: user.postnom ?? "",
      firstName: user.prenom ?? "",
      fullName: getFullName(user),
      img: user.image,
      matricule,
      roleLabel: "Enseignant",
      schoolName: branch.name,
      branchId,
      organizationId,
      branchLogo: branchImages.logo ?? null,
      displayId: teacher.id.slice(-6).padStart(6, "0"),
    };
  }

  const personnel = await prisma.personnel.findFirst({
    where: {
      id: entityId,
      branchMember: { branchId, branch: { organizationId } },
    },
    include: {
      branchMember: {
        include: {
          member: {
            include: { user: true },
          },
        },
      },
    },
  });

  const user = personnel?.branchMember?.member?.user;
  const memberRole = personnel?.branchMember?.member?.role;
  if (!personnel || !user) return null;

  const matricule =
    user.username ??
    buildStaffDisplayCode("personnel", personnel.id, branchId);

  return {
    kind: "personnel",
    entityId: personnel.id,
    userId: user.id,
    lastName: user.name,
    postName: user.postnom ?? "",
    firstName: user.prenom ?? "",
    fullName: getFullName(user),
    img: user.image,
    matricule,
    roleLabel: memberRole ? orgRoleLabel(memberRole) : "Personnel",
    schoolName: branch.name,
    branchId,
    organizationId,
    branchLogo: branchImages.logo ?? null,
    displayId: personnel.id.slice(-6).padStart(6, "0"),
  };
}
