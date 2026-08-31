import { BranchPageShell } from "@/components/layout/branch-page-shell";
import { Badge } from "@/components/ui/badge";
import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { IconReceipt } from "@tabler/icons-react";
import TransactionsClient from "./components/transactions-client";

export const dynamic = "force-dynamic";

export default async function BranchTransactionsPage() {
  const context = await requireBranchContext({ onMissing: "redirect" });
  await assertBranchAreaAccess("payroll", context.session, {
    organizationId: context.organizationId,
    branchId: context.branchId,
  });

  return (
    <BranchPageShell
      title="Transactions"
      description="Toutes les transactions de la branche active : élève, parent, référence, date, montant et classe."
      badge={
        <Badge variant="outline-primary" icon={<IconReceipt size={14} />}>
          Caisse
        </Badge>
      }
      contentClassName="space-y-4"
    >
      <TransactionsClient />
    </BranchPageShell>
  );
}
