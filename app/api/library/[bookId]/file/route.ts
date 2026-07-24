import { NextResponse } from "next/server";
import { Readable } from "stream";

import { resolveLibraryFileAccess } from "@/lib/library/access";
import { openLibraryFileStream } from "@/lib/library/storage";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{ bookId: string }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const { bookId } = await params;
  const access = await resolveLibraryFileAccess(bookId);

  if (!access.ok) {
    return NextResponse.json(
      { error: "Accès refusé" },
      { status: access.status },
    );
  }

  try {
    const { stream, mimeType, size } = await openLibraryFileStream(
      access.book.fileUrl,
    );

    void prisma.libraryBook
      .update({
        where: { id: access.book.id },
        data: { viewCount: { increment: 1 } },
      })
      .catch(() => undefined);

    const webStream = Readable.toWeb(stream) as unknown as ReadableStream;

    const headers: Record<string, string> = {
      "Content-Type": mimeType,
      "Content-Disposition": `inline; filename="book.${access.book.fileType === "EPUB" ? "epub" : "pdf"}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    };

    if (typeof size === "number") {
      headers["Content-Length"] = String(size);
    }

    return new NextResponse(webStream, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("LIBRARY_FILE_PROXY_ERROR:", error);
    return NextResponse.json(
      { error: "Fichier introuvable" },
      { status: 404 },
    );
  }
}
