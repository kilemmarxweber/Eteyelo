import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { ORG_ROLE } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const ATTENDANCE_KIOSK_USER_ID = "attendance-kiosk";

type KioskStore = {
  branchId: string;
  organizationId: string;
};

const attendanceKioskAls = new AsyncLocalStorage<KioskStore>();

export async function loadPublicAttendanceBranch(branchId: string) {
  const branch = await prisma.branch.findFirst({
    where: {
      id: branchId,
      isActive: true,
      organization: { isArchived: false },
    },
    select: {
      id: true,
      name: true,
      organizationId: true,
      typebranch: true,
      educationSystem: true,
    },
  });

  if (!branch) {
    throw new Error("Établissement introuvable.");
  }

  return branch;
}

export async function runAttendanceKiosk<T>(
  branchId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const branch = await loadPublicAttendanceBranch(branchId);
  return attendanceKioskAls.run(
    {
      branchId: branch.id,
      organizationId: branch.organizationId,
    },
    fn,
  );
}

function kioskSession(organizationId: string) {
  return {
    user: { id: ATTENDANCE_KIOSK_USER_ID, role: ORG_ROLE.OWNER },
    organization: { id: organizationId, role: ORG_ROLE.OWNER },
    member: { role: ORG_ROLE.OWNER },
    session: {
      activeOrganizationId: organizationId,
    },
  };
}

export async function requireAttendanceScanContext() {
  const kiosk = attendanceKioskAls.getStore();
  if (kiosk) {
    return {
      userId: ATTENDANCE_KIOSK_USER_ID,
      organizationId: kiosk.organizationId,
      branchId: kiosk.branchId,
      session: kioskSession(kiosk.organizationId),
      isKiosk: true as const,
    };
  }

  const ctx = await requireBranchContext();
  return { ...ctx, isKiosk: false as const };
}
