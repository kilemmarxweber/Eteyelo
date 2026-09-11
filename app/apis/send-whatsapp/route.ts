import { NextResponse } from "next/server";

/** Ancienne route Meta Graph API — l'envoi passe par Zindua (résultats → Notifier les parents). */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Utilisez Paramètres → Message WhatsApp (Zindua) et le bouton « Notifier les parents » sur les résultats.",
    },
    { status: 410 },
  );
}
