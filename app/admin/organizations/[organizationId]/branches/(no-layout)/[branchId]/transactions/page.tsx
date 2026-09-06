import { BranchPageShell } from "@/components/layout/branch-page-shell";
import { Badge } from "@/components/ui/badge";
import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { IconReceipt } from "@tabler/icons-react";
import { getTranslations } from "next-intl/server";
import TransactionsClient from "./components/transactions-client";

export const dynamic = "force-dynamic";

export default async function BranchTransactionsPage() {
  const t = await getTranslations("finance.transactions");
  const context = await requireBranchContext({ onMissing: "redirect" });
  await assertBranchAreaAccess("transactions", context.session, {
    organizationId: context.organizationId,
    branchId: context.branchId,
  });

  return (
    <BranchPageShell
      title={t("pageTitle")}
      description={t("pageDescription")}
      badge={
        <Badge variant="outline-primary" icon={<IconReceipt size={14} />}>
          {t("badge")}
        </Badge>
      }
      contentClassName="space-y-4"
    >
      <TransactionsClient />
    </BranchPageShell>
  );
}
