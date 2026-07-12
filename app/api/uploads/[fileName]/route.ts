import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getUploadDirectory } from "@/lib/upload-file.server";

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
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { fileName } = await params;

    const decodedFileName = decodeURIComponent(fileName);
    const safeFileName = path.basename(decodedFileName);

    if (!safeFileName || safeFileName !== decodedFileName) {
      return NextResponse.json(
        {
          ok: false,
          message: "Nom de fichier invalide.",
        },
        {
          status: 400,
        },
      );
    }

    const uploadDirectory = getUploadDirectory();
    const externalPath = path.join(uploadDirectory, safeFileName);
    const publicPath = path.join(process.cwd(), "public", "uploads", safeFileName);
    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(externalPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      fileBuffer = await fs.readFile(publicPath);
    }
    const extension = path.extname(safeFileName).toLowerCase();

    const responseBody = Uint8Array.from(fileBuffer);

    return new Response(responseBody, {
      status: 200,
      headers: {
        "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream",
        "Content-Length": String(fileBuffer.length),
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
    });

    return NextResponse.json(
      {
        ok: false,
        message:
          nodeError.code === "ENOENT"
            ? "Image introuvable sur le disque."
            : "Impossible de lire l’image.",
      },
      {
        status: nodeError.code === "ENOENT" ? 404 : 500,
      },
    );
  }
}
