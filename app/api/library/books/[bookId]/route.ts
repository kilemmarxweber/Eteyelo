import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { enforceLibraryManageAccess } from "@/lib/library/access";
import { libraryBookMetaSchema } from "@/lib/library/schemas";
import { deleteLibraryFile, uploadLibraryFile } from "@/lib/library/storage";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{ bookId: string }>;
};

function emptyToNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { bookId } = await params;
    const { branchId, organizationId } = await enforceLibraryManageAccess();

    const existing = await prisma.libraryBook.findFirst({
      where: { id: bookId, branchId },
      select: { id: true, fileUrl: true },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, message: "Livre introuvable" },
        { status: 404 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

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

    let fileUpdate: {
      fileUrl: string;
      fileType: "PDF" | "EPUB";
      fileSize: number;
    } | null = null;

    if (file instanceof File && file.size > 0) {
      const saved = await uploadLibraryFile(file, branchId);
      fileUpdate = {
        fileUrl: saved.storageKey,
        fileType: saved.fileType,
        fileSize: saved.fileSize,
      };
    }

    await prisma.libraryBook.update({
      where: { id: bookId },
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
        allowDownload: false,
        ...(fileUpdate
          ? {
              fileUrl: fileUpdate.fileUrl,
              fileType: fileUpdate.fileType,
              fileSize: fileUpdate.fileSize,
            }
          : {}),
      },
    });

    if (fileUpdate) {
      await deleteLibraryFile(existing.fileUrl);
    }

    revalidatePath(
      `/admin/organizations/${organizationId}/branches/${branchId}/bibliotheque`,
    );

    return NextResponse.json({
      ok: true,
      bookId,
      fileReplaced: Boolean(fileUpdate),
    });
  } catch (error) {
    console.error("LIBRARY_UPDATE_API_ERROR:", error);
    const message =
      error instanceof Error ? error.message : "Erreur lors de la mise à jour.";
    const status = message === "Action non autorisée" ? 403 : 500;
    return NextResponse.json({ ok: false, message }, { status });
  }
}
