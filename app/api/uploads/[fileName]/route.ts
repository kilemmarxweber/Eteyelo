import path from "path";
import { NextResponse } from "next/server";
import {
  listUploadDirectories,
  readUploadedFileBuffer,
} from "@/lib/upload-file.server";

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
  ".gif": "image/gif",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { fileName } = await params;
    const decodedFileName = decodeURIComponent(fileName);
    const fileBuffer = await readUploadedFileBuffer(decodedFileName);
    const extension = path.extname(decodedFileName).toLowerCase();
    const downloadName = path.basename(decodedFileName).replace(/"/g, "");
    const contentType = CONTENT_TYPES[extension] ?? "application/octet-stream";
    const disposition =
      extension === ".pdf"
        ? `inline; filename="${downloadName}"`
        : `inline; filename="${downloadName}"`;

    return new Response(Uint8Array.from(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(fileBuffer.length),
        "Content-Disposition": disposition,
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
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
