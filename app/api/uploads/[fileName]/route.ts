import path from "path";
import { NextResponse } from "next/server";
import {
  listUploadDirectories,
  readUploadedFileBuffer,
  safeUploadRelativePath,
} from "@/lib/upload-file.server";
import { getMobileSession, requireSession } from "@/lib/mobile/http";
import { getCachedSession } from "@/lib/auth/get-session-cached";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{
    fileName: string;
  }>;
};

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".apk": "application/vnd.android.package-archive",
  ".ipa": "application/octet-stream",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

const FORCE_DOWNLOAD_EXTENSIONS = new Set([".apk", ".ipa"]);

/** Téléchargements apps publics. */
const PUBLIC_UPLOAD_BASENAMES = new Set(["klambo.apk", "klambo.ipa"]);

/** Images branding / photos : publiques (nosniff). Médias messagerie (audio/vidéo/docs) : auth. */
const PUBLIC_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

async function hasAuthenticatedViewer() {
  const mobile = requireSession(await getMobileSession());
  if (mobile) return true;
  const web = await getCachedSession();
  return Boolean(web?.user?.id);
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { fileName } = await params;
    let relativePath: string;
    try {
      relativePath = safeUploadRelativePath(fileName);
    } catch {
      return NextResponse.json(
        { ok: false, message: "Nom de fichier invalide." },
        { status: 400 },
      );
    }

    const base = path.basename(relativePath).toLowerCase();
    const extension = path.extname(relativePath).toLowerCase();
    const isPublicApp = PUBLIC_UPLOAD_BASENAMES.has(base);
    const isPublicImage = PUBLIC_IMAGE_EXTENSIONS.has(extension);

    if (!isPublicApp && !isPublicImage) {
      const ok = await hasAuthenticatedViewer();
      if (!ok) {
        return NextResponse.json(
          { ok: false, message: "Authentification requise." },
          { status: 401 },
        );
      }
    }

    const fileBuffer = await readUploadedFileBuffer(relativePath);
    const downloadName = path.basename(relativePath).replace(/"/g, "");
    const contentType = CONTENT_TYPES[extension] ?? "application/octet-stream";
    const disposition = FORCE_DOWNLOAD_EXTENSIONS.has(extension)
      ? `attachment; filename="${downloadName}"`
      : `inline; filename="${downloadName}"`;

    return new Response(Uint8Array.from(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(fileBuffer.length),
        "Content-Disposition": disposition,
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox;",
      },
    });
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    console.error("UPLOAD_READ_ERROR:", {
      code: nodeError.code,
      message: nodeError.message,
      uploadDir: process.env.UPLOAD_DIR,
      cwd: process.cwd(),
      searchDirs: listUploadDirectories(),
    });

    const invalid = nodeError.code === "EINVAL";
    const missing = nodeError.code === "ENOENT";

    return NextResponse.json(
      {
        ok: false,
        message: invalid
          ? "Nom de fichier invalide."
          : missing
            ? "Fichier introuvable sur le disque."
            : "Impossible de lire le fichier.",
      },
      {
        status: invalid ? 400 : missing ? 404 : 500,
      },
    );
  }
}
