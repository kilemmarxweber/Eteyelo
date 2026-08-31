"use client";

import { useEffect, useState } from "react";

import { listAssignableOrganizationRolesAction } from "@/app/admin/organizations/[organizationId]/roles/roles.action";

export type AssignableOrgRoleOption = {
  slug: string;
  label: string;
  permissionKeys?: string[];
};

export function useAssignableOrgRoles(organizationId: string) {
  const [roles, setRoles] = useState<AssignableOrgRoleOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [data, err] = await listAssignableOrganizationRolesAction({
        organizationId,
      });
      if (cancelled) return;
      setLoading(false);
      if (err || !data?.length) return;
      setRoles(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  return { roles, loading };
}
