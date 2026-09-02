import { BranchPageShell } from "@/components/layout/branch-page-shell";
import { getFraisAction } from "../frais/frais.action";
import { notFound } from "next/navigation";

import PaymentClient from "./components/PaymentClient";
import { assertBranchAreaAccess, canAccessBranchAreaAsync } from "@/lib/auth/assert-branch-area-access";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { getPeopleLabels } from "@/lib/people-labels";
import { Badge } from "@/components/ui/badge";
import { IconWallet } from "@tabler/icons-react";
import { getServerTranslator } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function PaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; enrollmentId?: string }>;
}) {
  const query = await searchParams;
  const { typebranch, session, organizationId, branchId } =
    await requireBranchContext();
  await assertBranchAreaAccess("finance", session, {
    organizationId,
    branchId,
  });
  const t = await getServerTranslator("finance");
  const showUnpaidReport = await canAccessBranchAreaAsync(
    "fee_catalog",
    session,
    organizationId,
    branchId,
  );

  const peopleLabels = getPeopleLabels(typebranch);

  const [fraisListResult, fraisError] = await getFraisAction({});
  if (fraisError) {
    console.error("Error loading frais:", fraisError);
    notFound();
  }

  const initialSearch = query.q?.trim() || "";
  const initialEnrollmentId = query.enrollmentId?.trim() || "";

  return (
    <BranchPageShell
      title={t("payments.title")}
      description={t("payments.description", {
        students: peopleLabels.studentPluralLower,
      })}
      badge={
        <Badge variant="outline-primary" icon={<IconWallet size={14} />}>
          {t("payments.badge")}
        </Badge>
      }
      contentClassName="space-y-0"
    >
      <PaymentClient
        fraisList={fraisListResult}
        initialSearch={initialSearch}
        initialEnrollmentId={initialEnrollmentId}
        showUnpaidReport={showUnpaidReport}
      />
    </BranchPageShell>
  );
}
