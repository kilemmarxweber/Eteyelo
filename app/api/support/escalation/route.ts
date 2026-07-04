import { NextResponse } from "next/server";
import { z } from "zod";
import { createPlatformEscalationAction } from "@/lib/support/actions";

const schema = z.object({
  organizationId: z.string().min(1),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10).max(5000),
  priority: z.enum(["low", "normal", "high"]).optional(),
});

export async function POST(request: Request) {
  const payload = schema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json(
      { error: "Données invalides." },
      { status: 400 },
    );
  }

  const result = await createPlatformEscalationAction({
    ...payload.data,
    priority: payload.data.priority ?? "normal",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 403 });
  }

  return NextResponse.json({ ok: true, id: result.id });
}
