import { NextResponse } from "next/server";
import { listActivePlatformSupportAgents } from "@/lib/support/platform-support";

export async function GET() {
  const agents = await listActivePlatformSupportAgents();
  return NextResponse.json({ agents });
}
