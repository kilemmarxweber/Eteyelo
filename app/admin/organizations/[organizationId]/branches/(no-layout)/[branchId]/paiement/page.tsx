import { BranchPageShell } from "@/components/layout/branch-page-shell";
import { getFraisAction } from "../frais/frais.action";
import { notFound } from "next/navigation";

import PaymentClient from "./components/PaymentClient";
import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { getPeopleLabels } from "@/lib/people-labels";
import { Badge } from "@/components/ui/badge";
import { IconWallet } from "@tabler/icons-react";

export const dynamic = "force-dynamic";

export default async function PaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; enrollmentId?: string }>;
}) {
  const query = await searchParams;
  const { typebranch, session } = await requireBranchContext();
  await assertBranchAreaAccess("finance", session);

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
      title="Gestion des paiements"
      description={`Suivez les paiements des ${peopleLabels.studentPluralLower} et les soldes restants.`}
      badge={
        <Badge variant="outline-primary" icon={<IconWallet size={14} />}>
          Paiements
        </Badge>
      }
      contentClassName="space-y-0"
    >
      <PaymentClient
        fraisList={fraisListResult}
        initialSearch={initialSearch}
        initialEnrollmentId={initialEnrollmentId}
      />
    </BranchPageShell>
  );
}
