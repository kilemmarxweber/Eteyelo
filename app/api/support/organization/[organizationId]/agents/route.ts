import { NextResponse } from "next/server";
import { listActiveOrganizationSupportAgents } from "@/lib/support/organization-support";

type RouteContext = { params: Promise<{ organizationId: string }> };

export async function GET(
  request: Request,
  context: RouteContext,
) {
  const { organizationId } = await context.params;
  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");

  const agents = await listActiveOrganizationSupportAgents(
    organizationId,
    branchId,
  );

  return NextResponse.json({ agents });
}
