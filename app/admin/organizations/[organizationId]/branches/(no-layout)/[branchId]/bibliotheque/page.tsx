import { notFound } from "next/navigation";

import { enforceLibraryAccess } from "@/lib/library/access";
import { prisma } from "@/lib/prisma";

import { BibliothequeClient } from "./bibliotheque-client";

export const dynamic = "force-dynamic";

export default async function BibliothequePage() {
  let access;
  try {
    access = await enforceLibraryAccess();
  } catch {
    notFound();
  }

  const branch = await prisma.branch.findUnique({
    where: { id: access.branchId },
    select: { typebranch: true },
  });

  if (!branch) notFound();

  const books = await prisma.libraryBook.findMany({
    where: {
      branchId: access.branchId,
      ...(access.mode === "student" ? { isActive: true } : {}),
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

  const safeBooks = books.map((book) => ({
    id: book.id,
    title: book.title,
    author: book.author,
    publisher: book.publisher,
    description: book.description,
    coverImage: book.coverImage,
    fileType: book.fileType,
    language: book.language,
    cycle: book.cycle,
    level: book.level,
    section: book.section,
    subject: book.subject,
    category: book.category,
    tags: book.tags,
    viewCount: book.viewCount,
    createdAt: book.createdAt.toISOString(),
    ...(access.mode === "manage"
      ? {
          isActive: book.isActive,
          fileSize: book.fileSize,
          updatedAt: book.updatedAt.toISOString(),
        }
      : {}),
  }));

  return (
    <BibliothequeClient
      mode={access.mode}
      organizationId={access.organizationId}
      branchId={access.branchId}
      typebranch={branch.typebranch}
      initialBooks={safeBooks}
    />
  );
}
