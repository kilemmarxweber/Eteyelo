"use client";

import Link from "next/link";
import {
  BookOpen,
  Eye,
  EyeOff,
  FileText,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LIBRARY_CYCLE_LABELS } from "@/lib/library/taxonomy";
import { cn } from "@/lib/utils";

export type LibraryBookCardData = {
  id: string;
  title: string;
  author: string | null;
  publisher?: string | null;
  description: string | null;
  coverImage: string | null;
  fileType: "PDF" | "EPUB";
  language: string;
  cycle:
    | "PRIMAIRE"
    | "SECONDAIRE"
    | "HUMANITES"
    | "FORMATION"
    | "UNIVERSITE"
    | null;
  level: string | null;
  section: string | null;
  subject: string | null;
  category: string | null;
  tags: string[];
  viewCount: number;
  createdAt: string;
  isActive?: boolean;
  fileSize?: number | null;
};

type BookCardProps = {
  book: LibraryBookCardData;
  href: string;
  className?: string;
  manage?: {
    busy?: boolean;
    onEdit: () => void;
    onToggleActive: () => void;
    onDelete: () => void;
  };
};

function formatSize(bytes?: number | null) {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

/** Carte livre style rayonnage : couverture, détails, lien de lecture. */
export function BookCard({ book, href, className, manage }: BookCardProps) {
  const sizeLabel = formatSize(book.fileSize);
  const inactive = manage && book.isActive === false;

  return (
    <article
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all",
        "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg",
        inactive && "opacity-75",
        className,
      )}
    >
      {/* Couverture type livre */}
      <div className="relative bg-gradient-to-b from-muted/80 to-muted/30 p-3 pb-0">
        <div className="relative mx-auto aspect-[2/3] w-[72%] max-w-[160px]">
          <div
            className="absolute inset-y-1 -left-1.5 w-2 rounded-l-sm bg-gradient-to-r from-primary/40 to-primary/10"
            aria-hidden
          />
          <div className="relative size-full overflow-hidden rounded-r-md rounded-l-sm border border-border/80 bg-background shadow-[4px_6px_16px_-4px_rgba(0,0,0,0.35)] transition duration-500 group-hover:shadow-[6px_10px_20px_-4px_rgba(0,0,0,0.4)]">
            {book.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={book.coverImage}
                alt={`Couverture — ${book.title}`}
                className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
              />
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary/15 via-card to-primary/5 px-3 text-center text-primary">
                <BookOpen className="size-9 opacity-80" />
                <span className="line-clamp-3 text-[11px] font-semibold leading-snug text-foreground/80">
                  {book.title}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="absolute top-2.5 right-2.5 flex flex-col items-end gap-1">
          <Badge
            className="gap-1 border-border/60 bg-background/90 text-[10px] shadow-sm backdrop-blur"
            variant="secondary"
          >
            {book.fileType === "PDF" ? (
              <FileText className="size-3" />
            ) : (
              <BookOpen className="size-3" />
            )}
            {book.fileType}
          </Badge>
          {manage ? (
            <Badge
              variant={book.isActive ? "default" : "outline"}
              className="text-[10px] shadow-sm"
            >
              {book.isActive ? "Actif" : "Masqué"}
            </Badge>
          ) : null}
        </div>

        {manage ? (
          <div className="absolute top-2 left-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="size-8 bg-background/90 shadow-sm backdrop-blur"
                  disabled={manage.busy}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem asChild>
                  <Link href={href}>
                    <Eye className="mr-2 size-4" />
                    Lire
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={manage.onEdit}>
                  <Pencil className="mr-2 size-4" />
                  Modifier
                </DropdownMenuItem>
                <DropdownMenuItem onClick={manage.onToggleActive}>
                  <EyeOff className="mr-2 size-4" />
                  {book.isActive ? "Désactiver" : "Activer"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={manage.onDelete}
                >
                  <Trash2 className="mr-2 size-4" />
                  Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </div>

      {/* Détails */}
      <div className="flex flex-1 flex-col gap-2 p-3 pt-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          {book.title}
        </h3>

        <div className="mt-auto flex flex-wrap gap-1 pt-1">
          {book.cycle ? (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
              {LIBRARY_CYCLE_LABELS[
                book.cycle as keyof typeof LIBRARY_CYCLE_LABELS
              ] ?? book.cycle}
            </Badge>
          ) : null}
          {book.level ? (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
              {book.level}
            </Badge>
          ) : null}
          {book.subject ? (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
              {book.subject}
            </Badge>
          ) : null}
          {sizeLabel ? (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
              {sizeLabel}
            </Badge>
          ) : null}
        </div>

        <Button asChild className="mt-1 w-full gap-1.5" size="sm">
          <Link href={href}>
            <BookOpen className="size-3.5" />
            Lire
          </Link>
        </Button>
      </div>
    </article>
  );
}
