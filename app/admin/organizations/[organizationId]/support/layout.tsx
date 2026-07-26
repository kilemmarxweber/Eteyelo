import { notFound, redirect } from "next/navigation";
import { getOrganizationAuthContext } from "@/lib/auth/require-organization-permission";
import { canAccessOrganizationSupportArea } from "@/lib/support/permissions";

export default async function OrganizationSupportLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const context = await getOrganizationAuthContext();
  if (!context) {
    redirect("/auth/sign-in");
  }

  const allowed = await canAccessOrganizationSupportArea(organizationId);
  if (!allowed) {
    notFound();
  }

  return children;
}
