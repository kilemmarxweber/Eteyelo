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

/** Carte livre compacte : couverture courte, infos essentielles. */
export function BookCard({ book, href, className, manage }: BookCardProps) {
  const inactive = manage && book.isActive === false;
  const meta = [
    book.fileType,
    book.subject,
    book.level,
    book.cycle
      ? (LIBRARY_CYCLE_LABELS[
          book.cycle as keyof typeof LIBRARY_CYCLE_LABELS
        ] ?? book.cycle)
      : null,
  ].filter(Boolean) as string[];

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border border-border/80 bg-card",
        "transition-colors hover:border-primary/35 hover:bg-muted/20",
        inactive && "opacity-60",
        className,
      )}
    >
      {manage ? (
        <div className="absolute top-1.5 right-1.5 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7 bg-background/80 opacity-0 shadow-sm backdrop-blur transition group-hover:opacity-100 data-[state=open]:opacity-100"
                disabled={manage.busy}
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={href}>
                  <Eye className="mr-2 size-3.5" />
                  Lire
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={manage.onEdit}>
                <Pencil className="mr-2 size-3.5" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem onClick={manage.onToggleActive}>
                <EyeOff className="mr-2 size-3.5" />
                {book.isActive ? "Désactiver" : "Activer"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={manage.onDelete}
              >
                <Trash2 className="mr-2 size-3.5" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}

      <Link href={href} className="flex min-h-0 flex-1 flex-col outline-none">
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted/40">
          {book.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={book.coverImage}
              alt=""
              className="size-full object-cover transition duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-primary/10 to-transparent px-3 text-center text-muted-foreground">
              <BookOpen className="size-7 opacity-70" />
              <span className="line-clamp-3 text-[11px] font-medium leading-snug text-foreground/70">
                {book.title}
              </span>
            </div>
          )}
          <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-0.5 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium text-foreground shadow-sm backdrop-blur">
            {book.fileType === "PDF" ? (
              <FileText className="size-2.5" />
            ) : (
              <BookOpen className="size-2.5" />
            )}
            {book.fileType}
          </span>
          {manage && book.isActive === false ? (
            <Badge
              variant="outline"
              className="absolute top-1.5 left-1.5 h-5 border-border/70 bg-background/90 px-1.5 text-[10px]"
            >
              Masqué
            </Badge>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col gap-0.5 p-2.5">
          <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">
            {book.title}
          </h3>
          {book.author ? (
            <p className="truncate text-[11px] text-muted-foreground">
              {book.author}
            </p>
          ) : null}
          {meta.length > 1 ? (
            <p className="mt-1 line-clamp-1 text-[10px] text-muted-foreground">
              {meta.slice(1).join(" · ")}
            </p>
          ) : null}
        </div>
      </Link>
    </article>
  );
}
