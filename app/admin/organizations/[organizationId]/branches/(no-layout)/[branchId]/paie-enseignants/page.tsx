import { BranchPageShell } from "@/components/layout/branch-page-shell";
import { Badge } from "@/components/ui/badge";
import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { IconCash } from "@tabler/icons-react";
import PayrollClient from "./components/payroll-client";

export const dynamic = "force-dynamic";

export default async function TeacherPayrollPage() {
  const context = await requireBranchContext();
  await assertBranchAreaAccess("payroll", context.session, {
    organizationId: context.organizationId,
    branchId: context.branchId,
  });

  return (
    <BranchPageShell
      title="Paie des enseignants"
      description="Calculez les bulletins mensuels à partir des séances et des présences."
      badge={
        <Badge variant="outline-primary" icon={<IconCash size={14} />}>
          Paie V1
        </Badge>
      }
      contentClassName="space-y-4"
    >
      <PayrollClient />
    </BranchPageShell>
  );
}
