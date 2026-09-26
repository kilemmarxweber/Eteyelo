import { UploadResponse } from "@/lib/upload-file";
import { saveUploadedVideo } from "@/lib/upload-file.server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
/** Uploads vidéo jusqu’à 50 Mo — laisser le temps au réseau lent. */
export const maxDuration = 120;

export async function POST(
  request: Request,
): Promise<NextResponse<UploadResponse>> {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Aucun fichier reçu.",
        },
        { status: 400 },
      );
    }

    const savedFile = await saveUploadedVideo(file);

    return NextResponse.json(
      {
        ok: true,
        fileName: savedFile.fileName,
        url: savedFile.url,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("UPLOAD_VIDEO_API_ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Erreur lors de l'upload de la vidéo.",
      },
      { status: 500 },
    );
  }
}
