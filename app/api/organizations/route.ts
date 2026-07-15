import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getOrganizationsAccessContext } from "@/lib/auth/organization-access";

export async function GET() {
  const context = await getOrganizationsAccessContext(await headers());

  if (!context) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  return NextResponse.json({
    organizations: context.organizations,
    canCreate: context.canCreate,
    canDelete: context.canDelete,
    canArchive: context.canArchive,
    canListAll: context.canListAll,
    isPlatformOwner: context.isPlatformOwner,
    isOrgManager: context.isOrgManager,
    roleLabel: context.roleLabel,
    appRole: context.appRole,
    membershipRole: context.membershipRole,
    membershipOrganizationId: context.membershipOrganizationId,
  });
}
