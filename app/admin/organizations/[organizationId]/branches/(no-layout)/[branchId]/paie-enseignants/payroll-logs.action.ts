"use server";

import { z } from "zod";

import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";
import { canComputePayroll } from "@/lib/auth/session-roles";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { prisma } from "@/lib/prisma";
import { action } from "@/lib/zsa";

const PAYROLL_LOG_TYPES = ["PAYROLL", "PAYROLL_DEDUCTION"] as const;

function personName(user: {
  prenom?: string | null;
  name?: string | null;
  postnom?: string | null;
} | null) {
  if (!user) return "Utilisateur";
  return (
    [user.prenom, user.name, user.postnom].filter(Boolean).join(" ").trim() ||
    user.name ||
    "Utilisateur"
  );
}

async function getPayrollLogsContext() {
  const context = await requireBranchContext();
  await assertBranchAreaAccess("payroll", context.session, {
    organizationId: context.organizationId,
    branchId: context.branchId,
  });
  if (!canComputePayroll(context.session)) {
    throw new Error("Vous n'avez pas le droit de gérer les logs de paie");
  }
  return context;
}

export type PayrollNotificationLogRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
  recipientName: string;
  recipientEmail: string | null;
};

export const listPayrollNotificationLogsAction = action.handler(async () => {
  const context = await getPayrollLogsContext();
  const where = {
    branchId: context.branchId,
    type: { in: [...PAYROLL_LOG_TYPES] },
  };

  const [rows, total, unread] = await Promise.all([
    prisma.appNotification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        href: true,
        readAt: true,
        createdAt: true,
        user: {
          select: { prenom: true, name: true, postnom: true, email: true },
        },
      },
    }),
    prisma.appNotification.count({ where }),
    prisma.appNotification.count({ where: { ...where, readAt: null } }),
  ]);

  const mapped: PayrollNotificationLogRow[] = rows.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    href: row.href,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    recipientName: personName(row.user),
    recipientEmail: row.user.email,
  }));

  return { rows: mapped, total, unread };
});

export const deletePayrollNotificationLogsAction = action
  .input(
    z.object({
      notificationIds: z.array(z.string().min(1)).max(500).optional(),
      all: z.boolean().optional(),
    }),
  )
  .handler(async ({ input }) => {
    const context = await getPayrollLogsContext();
    const ids = input.notificationIds ?? [];
    if (!input.all && ids.length === 0) return { count: 0 };

    const result = await prisma.appNotification.deleteMany({
      where: {
        branchId: context.branchId,
        type: { in: [...PAYROLL_LOG_TYPES] },
        ...(input.all ? {} : { id: { in: ids } }),
      },
    });
    return { count: result.count };
  });
