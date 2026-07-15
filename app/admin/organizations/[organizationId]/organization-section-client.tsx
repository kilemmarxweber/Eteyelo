"use client";

import { useEffect, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";

export function OrganizationSectionClient({
  organizationId,
  children,
}: {
  organizationId: string;
  children: ReactNode;
}) {
  useEffect(() => {
    void authClient.organization.setActive({ organizationId });
  }, [organizationId]);

  return <div className="flex flex-col">{children}</div>;
}
