import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  saveUploadedFile,
} from "@/lib/upload-file.server";

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.session?.id) {
    return NextResponse.json(
      { ok: false, message: "Non autorisé." },
      { status: 401 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, message: "Aucun fichier reçu." },
      { status: 400 },
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        message: `Fichier trop volumineux (max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} Mo).`,
      },
      { status: 413 },
    );
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return NextResponse.json(
      { ok: false, message: "Type de fichier non autorisé." },
      { status: 400 },
    );
  }

  try {
    const saved = await saveUploadedFile(file);

    if (!saved) {
      return NextResponse.json(
        { ok: false, message: "Erreur lors de l'upload du fichier." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      fileName: saved.fileName,
      url: saved.url,
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Erreur lors de l'upload du fichier." },
      { status: 500 },
    );
  }
}
