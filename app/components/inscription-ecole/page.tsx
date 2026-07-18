import { CreateBranchForm } from "@/app/admin/organizations/[organizationId]/branches/(no-layout)/new/components/create-branch-form";
import { HomeFooter } from "@/components/home-footer";
import { HomeNavbar } from "@/components/home-navbar";

import { submitSchoolRegistrationRequestAction } from "./ecole.action";

export default function InscriptionEcolePage() {
  return (
    <div className="min-h-screen bg-background">
      <HomeNavbar />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <CreateBranchForm
          organizationId=""
          createAction={submitSchoolRegistrationRequestAction}
          submissionMode="request"
          successRedirectPath={false}
          successMessage="Demande envoyée avec succès. Un email de confirmation vous a été envoyé. Klambocore l'examinera et vous contactera."
        />
      </div>

      <HomeFooter />
    </div>
  );
}
