import { NextResponse } from "next/server";

import { getNotificationBadgeCounts } from "@/lib/notifications/badge-counts";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getNotificationBadgeCounts();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
}
