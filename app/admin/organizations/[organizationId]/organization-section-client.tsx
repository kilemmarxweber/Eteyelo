"use client";

import { useEffect, type ReactNode } from "react";

import { activateOrganizationSessionAction } from "./activate-organization.action";

export function OrganizationSectionClient({
  organizationId,
  children,
}: {
  organizationId: string;
  children: ReactNode;
}) {
  useEffect(() => {
    void activateOrganizationSessionAction(organizationId);
  }, [organizationId]);

  return <div className="flex flex-col">{children}</div>;
}
