import { NextResponse } from "next/server";

import { enforceLibraryManageAccess } from "@/lib/library/access";
import { libraryBookMetaSchema } from "@/lib/library/schemas";
import { uploadLibraryFile } from "@/lib/library/storage";
import { prisma } from "@/lib/prisma";
import { LibrarySource, LibraryVisibility } from "@/prisma/generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function emptyToNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function POST(request: Request) {
  try {
    const { branchId, userId, organizationId } =
      await enforceLibraryManageAccess();

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, message: "Fichier PDF ou EPUB requis." },
        { status: 400 },
      );
    }

    const parsed = libraryBookMetaSchema.safeParse({
      title: formData.get("title"),
      author: emptyToNull(formData.get("author")),
      publisher: emptyToNull(formData.get("publisher")),
      description: emptyToNull(formData.get("description")),
      coverImage: emptyToNull(formData.get("coverImage")),
      cycle: emptyToNull(formData.get("cycle")),
      level: emptyToNull(formData.get("level")),
      section: emptyToNull(formData.get("section")),
      subject: emptyToNull(formData.get("subject")),
      category: emptyToNull(formData.get("category")),
      language: emptyToNull(formData.get("language")) ?? "fr",
      license: emptyToNull(formData.get("license")),
      isbn: emptyToNull(formData.get("isbn")),
      isActive: formData.get("isActive") !== "false",
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          message: parsed.error.issues[0]?.message ?? "Données invalides",
        },
        { status: 400 },
      );
    }

    const saved = await uploadLibraryFile(file, branchId);

    const book = await prisma.libraryBook.create({
      data: {
        title: parsed.data.title,
        author: parsed.data.author,
        publisher: parsed.data.publisher,
        description: parsed.data.description,
        coverImage: parsed.data.coverImage,
        cycle: parsed.data.cycle ?? null,
        level: parsed.data.level,
        section: parsed.data.section,
        subject: parsed.data.subject,
        category: parsed.data.category,
        language: parsed.data.language ?? "fr",
        license: parsed.data.license,
        isbn: parsed.data.isbn,
        isActive: parsed.data.isActive ?? true,
        fileUrl: saved.storageKey,
        fileType: saved.fileType,
        fileSize: saved.fileSize,
        visibility: LibraryVisibility.STUDENTS,
        allowDownload: false,
        source: LibrarySource.SCHOOL_UPLOAD,
        branchId,
        createdById: userId,
      },
      select: {
        id: true,
        title: true,
        fileType: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        book,
        organizationId,
        branchId,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("LIBRARY_CREATE_API_ERROR:", error);
    const message =
      error instanceof Error ? error.message : "Erreur lors de la création.";
    const status = message === "Action non autorisée" ? 403 : 500;
    return NextResponse.json({ ok: false, message }, { status });
  }
}
