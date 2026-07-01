"use server";
import { Layout, LayoutBody } from "@/components/custom/layout";
import PaiementsTable from "./components/PaiementsTable";
import PaymentsForm from "./components/PaymentsForm";
import { getFraisAction } from "../frais/frais.action";
import { getClassEnrolements } from "../classEnrollment/classEnrollment.action";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import PaymentClient from "./components/PaymentClient";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
export default async function PaymentPage() {
  await requireBranchContext();

  const [fraisListResult, fraisError] = await getFraisAction();
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
    <Layout>
      <LayoutBody className="space-y-4">
        <div className="flex items-center justify-between space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-primary md:text-3xl dark:text-white">
            Gestion des paiements
          </h1>
        </div>

        <Card className="p-1" variant="elevated">
          <PaymentClient
            fraisList={fraisListResult}
            classEnrollList={safeEnrollList}
          />
        </Card>
      </LayoutBody>
    </Layout>
  );
}
