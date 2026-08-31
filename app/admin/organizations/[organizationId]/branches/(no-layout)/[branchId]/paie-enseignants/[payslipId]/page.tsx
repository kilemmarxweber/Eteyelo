import { notFound } from "next/navigation";
import { BranchPageShell } from "@/components/layout/branch-page-shell";
import { Badge } from "@/components/ui/badge";
import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { getTeacherPayslipAction } from "../payroll.action";
import PayslipDetailClient from "../components/payslip-detail-client";

export const dynamic = "force-dynamic";

export default async function TeacherPayslipDetailPage({
  params,
}: {
  params: Promise<{ payslipId: string }>;
}) {
  const context = await requireBranchContext({ onMissing: "redirect" });
  await assertBranchAreaAccess("payroll", context.session, {
    organizationId: context.organizationId,
    branchId: context.branchId,
  });
  const { payslipId } = await params;
  const [payslip, error] = await getTeacherPayslipAction({ payslipId });
  if (error || !payslip) notFound();

  return (
    <BranchPageShell
      title="Bulletin de paie"
      description={`${payslip.month}/${payslip.year} · ${payslip.currency}`}
      badge={<Badge variant="outline-primary">Détail</Badge>}
      contentClassName="space-y-4"
    >
      <PayslipDetailClient
        payslip={JSON.parse(JSON.stringify(payslip)) as never}
        backHref={`/admin/organizations/${context.organizationId}/branches/${context.branchId}/paie-enseignants`}
      />
    </BranchPageShell>
  );
}
