import { notFound } from "next/navigation";

import { BackLink } from "@/components/ui/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { enforceOrganizationManagerPage } from "@/lib/auth/require-organization-permission";
import { parseRentreeProgram } from "@/lib/registration-public-info";
import {
  getOrganizationBranchesForRegistration,
  getRegistrationInfoForEdit,
} from "../../actions";
import { RegistrationInfoForm } from "../../registration-info-form";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ organizationId: string; infoId: string }>;
};

export default async function EditInscriptionPubliquePage({
  params,
}: PageProps) {
  const { organizationId, infoId } = await params;
  await enforceOrganizationManagerPage(organizationId);

  let branches;
  let info;
  try {
    [branches, info] = await Promise.all([
      getOrganizationBranchesForRegistration(organizationId),
      getRegistrationInfoForEdit(organizationId, infoId),
    ]);
  } catch {
    notFound();
  }

  if (!info) notFound();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <BackLink
        href={`/admin/organizations/${organizationId}/inscription-publique`}
        label="Retour a la liste"
      />
      <Card>
        <CardHeader>
          <CardTitle>Modifier la fiche — {info.branch.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <RegistrationInfoForm
            organizationId={organizationId}
            branches={branches}
            initialValues={{
              id: info.id,
              branchId: info.branchId,
              schoolYearId: info.schoolYearId ?? "",
              isPublished: info.isPublished,
              termsTitle: info.termsTitle,
              termsContent: info.termsContent,
              registrationFeeRequired: info.registrationFeeRequired,
              registrationFeeAmount:
                info.registrationFeeAmount != null
                  ? String(Number(info.registrationFeeAmount))
                  : "",
              registrationFeeCurrency: info.registrationFeeCurrency,
              registrationFeeLabel: info.registrationFeeLabel ?? "",
              registrationFeeDueNote: info.registrationFeeDueNote ?? "",
              rentreeProgram: parseRentreeProgram(info.rentreeProgram),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
