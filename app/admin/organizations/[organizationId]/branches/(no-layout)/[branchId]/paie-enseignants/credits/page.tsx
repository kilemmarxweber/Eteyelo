import { redirect } from "next/navigation";

import {
  assertBranchAreaAccess,
  sessionAllowsPayrollAction,
} from "@/lib/auth/assert-branch-area-access";
import { requireBranchContext } from "@/lib/auth/require-branch-context";

export const dynamic = "force-dynamic";

export default async function SalaryCreditsPage() {
  const context = await requireBranchContext({ onMissing: "redirect" });
  await assertBranchAreaAccess("payroll", context.session, {
    organizationId: context.organizationId,
    branchId: context.branchId,
  });

  const canManage = await sessionAllowsPayrollAction(
    context.session,
    "compute",
    context.organizationId,
    context.branchId,
  );
  const base = `/admin/organizations/${context.organizationId}/branches/${context.branchId}/paie-enseignants`;
  if (!canManage) {
    redirect(base);
  }

  redirect(`${base}?tab=credit`);
}
