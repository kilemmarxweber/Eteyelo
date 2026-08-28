"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { IconShieldLock } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { OrganizationRolesManager } from "@/app/admin/organizations/[organizationId]/roles/roles-manager";
import { RequireBranchOrgSettingsAccess } from "../components/require-branch-org-settings-access";

export default function SettingsRolesPage() {
  const t = useTranslations("settings");
  const params = useParams();
  const organizationId = params.organizationId as string;

  return (
    <RequireBranchOrgSettingsAccess level="owner">
      <div className="space-y-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{t("rolesPrivileges")}</h2>
            <Badge
              variant="outline-primary"
              icon={<IconShieldLock size={14} />}
            >
              {t("title")}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("rolesPrivilegesDesc")}
          </p>
        </div>

        <OrganizationRolesManager organizationId={organizationId} />
      </div>
    </RequireBranchOrgSettingsAccess>
  );
}
