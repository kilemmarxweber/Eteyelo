import { notFound } from "next/navigation";

import { BackLink } from "@/components/ui/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { enforceOrganizationManagerPage } from "@/lib/auth/require-organization-permission";
import { getOrganizationBranchesForRegistration } from "../actions";
import { RegistrationInfoForm } from "../registration-info-form";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function NewInscriptionPubliquePage({
  params,
}: PageProps) {
  const { organizationId } = await params;
  await enforceOrganizationManagerPage(organizationId);

  let branches;
  try {
    branches = await getOrganizationBranchesForRegistration(organizationId);
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <BackLink
        href={`/admin/organizations/${organizationId}/inscription-publique`}
        label="Retour a la liste"
      />
      <Card>
        <CardHeader>
          <CardTitle>Nouvelle fiche d&apos;inscription publique</CardTitle>
        </CardHeader>
        <CardContent>
          <RegistrationInfoForm
            organizationId={organizationId}
            branches={branches}
          />
        </CardContent>
      </Card>
    </div>
  );
}
