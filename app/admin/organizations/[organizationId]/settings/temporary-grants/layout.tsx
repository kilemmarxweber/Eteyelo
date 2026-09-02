import type { ReactNode } from "react";
import { enforceOrganizationManagerPage } from "@/lib/auth/require-organization-permission";

export default async function TemporaryGrantsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  await enforceOrganizationManagerPage(organizationId);
  return children;
}
