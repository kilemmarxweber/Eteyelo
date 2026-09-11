import { NextResponse } from "next/server";

/** L'envoi des bulletins se fait depuis la page Résultats (Zindua + email). */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Utilisez le bouton « Notifier les parents » sur la page Résultats.",
    },
    { status: 410 },
  );
}
