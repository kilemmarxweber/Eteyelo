"use server";

import { revalidatePath } from "next/cache";

import {
  enabledCatalogSourceWhere,
  enforceLibraryAccess,
  enforceLibraryManageAccess,
  toPublicLibraryBook,
} from "@/lib/library/access";
import {
  canPermanentlyDeleteInformation,
  PERMANENT_DELETE_DENIED_MESSAGE,
} from "@/lib/auth/session-roles";
import {
  libraryBookIdSchema,
  updateLibraryBookSchema,
} from "@/lib/library/schemas";
import { deleteLibraryFile } from "@/lib/library/storage";
import { prisma } from "@/lib/prisma";
import { action } from "@/lib/zsa";
import z from "zod";

function revalidateLibraryPages(organizationId: string, branchId: string) {
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/bibliotheque`,
  );
}

const catalogFilterSchema = z.object({
  q: z.string().optional(),
  cycle: z.enum(["PRIMAIRE", "SECONDAIRE", "HUMANITES"]).optional(),
  subject: z.string().optional(),
  level: z.string().optional(),
  includeInactive: z.boolean().optional(),
});

export const listLibraryBooksAction = action
  .input(catalogFilterSchema)
  .handler(async ({ input }) => {
    const { branchId, mode } = await enforceLibraryAccess();

    const books = await prisma.libraryBook.findMany({
      where: {
        branchId,
        ...(mode === "student" || !input.includeInactive
          ? { isActive: true }
          : {}),
        ...(input.cycle ? { cycle: input.cycle } : {}),
        ...(input.subject ? { subject: input.subject } : {}),
        ...(input.level ? { level: input.level } : {}),
        AND: [
          enabledCatalogSourceWhere,
          ...(input.q?.trim()
            ? [
                {
                  OR: [
                    {
                      title: {
                        contains: input.q.trim(),
                        mode: "insensitive" as const,
                      },
                    },
                    {
                      author: {
                        contains: input.q.trim(),
                        mode: "insensitive" as const,
                      },
                    },
                    {
                      subject: {
                        contains: input.q.trim(),
                        mode: "insensitive" as const,
                      },
                    },
                  ],
                },
              ]
            : []),
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        author: true,
        publisher: true,
        description: true,
        coverImage: true,
        fileType: true,
        language: true,
        cycle: true,
        level: true,
        section: true,
        subject: true,
        category: true,
        tags: true,
        viewCount: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        fileSize: true,
      },
    });

    return {
      mode,
      books: books.map((book) => {
        const publicBook = toPublicLibraryBook(book);
        return mode === "manage"
          ? {
              ...publicBook,
              isActive: book.isActive,
              fileSize: book.fileSize,
              updatedAt: book.updatedAt,
            }
          : publicBook;
      }),
    };
  });

export const getLibraryBookAction = action
  .input(libraryBookIdSchema)
  .handler(async ({ input }) => {
    const { branchId, mode } = await enforceLibraryAccess();

    const book = await prisma.libraryBook.findFirst({
      where: {
        id: input.id,
        branchId,
        ...(mode === "student" ? { isActive: true } : {}),
        ...enabledCatalogSourceWhere,
      },
      select: {
        id: true,
        title: true,
        author: true,
        publisher: true,
        description: true,
        coverImage: true,
        fileType: true,
        language: true,
        cycle: true,
        level: true,
        section: true,
        subject: true,
        category: true,
        tags: true,
        viewCount: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!book) {
      throw new Error("Livre introuvable");
    }

    return toPublicLibraryBook(book);
  });

export const updateLibraryBookAction = action
  .input(updateLibraryBookSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await enforceLibraryManageAccess();

    const existing = await prisma.libraryBook.findFirst({
      where: { id: input.id, branchId },
      select: { id: true },
    });

    if (!existing) {
      throw new Error("Livre introuvable");
    }

    const { id, ...data } = input;

    await prisma.libraryBook.update({
      where: { id },
      data: {
        title: data.title,
        author: data.author,
        publisher: data.publisher,
        description: data.description,
        coverImage: data.coverImage,
        cycle: data.cycle ?? null,
        level: data.level,
        section: data.section,
        subject: data.subject,
        category: data.category,
        language: data.language ?? "fr",
        license: data.license,
        isbn: data.isbn,
        isActive: data.isActive ?? true,
        allowDownload: false,
      },
    });

    revalidateLibraryPages(organizationId, branchId);
    return { ok: true };
  });

export const setLibraryBookActiveAction = action
  .input(
    z.object({
      id: z.string().min(1),
      isActive: z.boolean(),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await enforceLibraryManageAccess();

    const existing = await prisma.libraryBook.findFirst({
      where: { id: input.id, branchId },
      select: { id: true },
    });

    if (!existing) {
      throw new Error("Livre introuvable");
    }

    await prisma.libraryBook.update({
      where: { id: input.id },
      data: { isActive: input.isActive },
    });

    revalidateLibraryPages(organizationId, branchId);
    return { ok: true };
  });

export const deleteLibraryBookAction = action
  .input(libraryBookIdSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, session } =
      await enforceLibraryManageAccess();
    if (!canPermanentlyDeleteInformation(session)) {
      throw new Error(PERMANENT_DELETE_DENIED_MESSAGE);
    }

    const existing = await prisma.libraryBook.findFirst({
      where: { id: input.id, branchId },
      select: { id: true, fileUrl: true },
    });

    if (!existing) {
      throw new Error("Livre introuvable");
    }

    await prisma.libraryBook.delete({ where: { id: input.id } });
    await deleteLibraryFile(existing.fileUrl);

    revalidateLibraryPages(organizationId, branchId);
    return { ok: true };
  });
