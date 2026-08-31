import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EpubReader } from "@/components/library/epub-reader";
import { PdfReader } from "@/components/library/pdf-reader";
import { enforceLibraryAccess } from "@/lib/library/access";
import { LIBRARY_CYCLE_LABELS } from "@/lib/library/taxonomy";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    organizationId: string;
    branchId: string;
    bookId: string;
  }>;
};

export default async function LibraryBookReaderPage({ params }: PageProps) {
  const { organizationId, branchId, bookId } = await params;

  let access;
  try {
    access = await enforceLibraryAccess();
  } catch {
    notFound();
  }

  if (access.branchId !== branchId) {
    notFound();
  }

  const book = await prisma.libraryBook.findFirst({
    where: {
      id: bookId,
      branchId: access.branchId,
      ...(access.mode === "student" ? { isActive: true } : {}),
      OR: [
        { catalogSourceId: null },
        { catalogSource: { isEnabled: true } },
      ],
    },
    select: {
      id: true,
      title: true,
      author: true,
      description: true,
      fileType: true,
      cycle: true,
      level: true,
      subject: true,
      section: true,
    },
  });

  if (!book) {
    notFound();
  }

  const catalogHref = `/admin/organizations/${organizationId}/branches/${branchId}/bibliotheque`;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="gap-1.5">
          <Link href={catalogHref}>
            <ArrowLeft className="size-4" />
            Catalogue
          </Link>
        </Button>
        <Badge variant="outline" className="gap-1">
          <BookOpen className="size-3" />
          Lecture seule
        </Badge>
      </div>

      <PageHeader
        title={book.title}
        description={
          [book.author, book.subject, book.level]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        badge={
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">{book.fileType}</Badge>
            {book.cycle ? (
              <Badge variant="outline">
                {LIBRARY_CYCLE_LABELS[
                  book.cycle as keyof typeof LIBRARY_CYCLE_LABELS
                ] ?? book.cycle}
              </Badge>
            ) : null}
            {book.section ? (
              <Badge variant="outline">{book.section}</Badge>
            ) : null}
          </div>
        }
      />

      {book.description ? (
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {book.description}
        </p>
      ) : null}

      {book.fileType === "PDF" ? (
        <PdfReader bookId={book.id} />
      ) : (
        <EpubReader bookId={book.id} />
      )}
    </div>
  );
}
