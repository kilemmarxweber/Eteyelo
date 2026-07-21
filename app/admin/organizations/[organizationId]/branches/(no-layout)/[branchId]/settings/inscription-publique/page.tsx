"use client";

import { RequireBranchOrgSettingsAccess } from "../components/require-branch-org-settings-access";
import { BranchRegistrationSettingsForm } from "./branch-registration-settings-form";

export default function InscriptionPubliqueSettingsPage() {
  return (
    <RequireBranchOrgSettingsAccess>
      <BranchRegistrationSettingsForm />
    </RequireBranchOrgSettingsAccess>
  );
}
