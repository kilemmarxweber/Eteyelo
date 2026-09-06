import { BranchPageShell } from "@/components/layout/branch-page-shell";
import { Badge } from "@/components/ui/badge";
import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { IconCash } from "@tabler/icons-react";
import { getTranslations } from "next-intl/server";
import PayrollClient from "./components/payroll-client";

export const dynamic = "force-dynamic";

export default async function TeacherPayrollPage() {
  const t = await getTranslations("finance.payroll");
  const context = await requireBranchContext({ onMissing: "redirect" });
  await assertBranchAreaAccess("payroll", context.session, {
    organizationId: context.organizationId,
    branchId: context.branchId,
  });

  return (
    <BranchPageShell
      title={t("pageTitle")}
      description={t("pageDescription")}
      badge={
        <Badge variant="outline-primary" icon={<IconCash size={14} />}>
          {t("badge")}
        </Badge>
      }
      contentClassName="space-y-4"
    >
      <PayrollClient />
    </BranchPageShell>
  );
}
