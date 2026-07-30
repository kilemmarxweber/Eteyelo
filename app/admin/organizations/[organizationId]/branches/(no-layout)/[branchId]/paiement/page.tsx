"use server";

import { BranchPageShell } from "@/components/layout/branch-page-shell";
import { getFraisAction } from "../frais/frais.action";
import { getClassEnrolements } from "../classEnrollment/classEnrollment.action";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import PaymentClient from "./components/PaymentClient";
import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { getPeopleLabels } from "@/lib/people-labels";
import { Badge } from "@/components/ui/badge";
import { IconWallet } from "@tabler/icons-react";

export default async function PaymentPage() {
  const { typebranch, session } = await requireBranchContext();
  await assertBranchAreaAccess("finance", session);

  const peopleLabels = getPeopleLabels(typebranch);

  const [fraisListResult, fraisError] = await getFraisAction({});
  if (fraisError) {
    console.error("Error loading frais:", fraisError);
    notFound();
  }
  const [enrollList, enrollErr] = await getClassEnrolements();
  if (enrollErr || !enrollList) {
    return null;
  }

  const safeEnrollList = enrollList.map((e) => ({
    id: e.id,
    prenom: e.prenom ?? "",
    nom: e.nom ?? "",
    postnom: e.postnom ?? "",
    classe: e.nameClasse ?? "", // adapte selon ton modèle
    classeId: e.classeId ?? "",
  }));

  return (
    <BranchPageShell
      title="Gestion des paiements"
          description={`Suivez les paiements des ${peopleLabels.studentPluralLower} et les soldes restants.`}
          badge={
            <Badge variant="outline-primary" icon={<IconWallet size={14} />}>
              Paiements
            </Badge>
          }
    >
      <Card className="p-1" variant="elevated">
          <PaymentClient
            fraisList={fraisListResult}
            classEnrollList={safeEnrollList}
          />
        </Card>
    </BranchPageShell>
  );
}
