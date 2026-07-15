import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getOrganizationAccessAction } from "@/app/admin/organizations/actions";

type RouteContext = {
  params: Promise<{ organizationId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { organizationId } = await context.params;
  const access = await getOrganizationAccessAction(organizationId);

  if (!access) {
    return NextResponse.json(
      { error: "Organisation introuvable ou accès refusé" },
      { status: 404 },
    );
  }

  return NextResponse.json(access);
}
