"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, Cloud, LibraryBig, Plus, Search } from "lucide-react";

import { BranchPageShell } from "@/components/layout/branch-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LibraryAccessMode } from "@/lib/library/access";
import { getLibraryTaxonomy } from "@/lib/library/taxonomy";
import type { LibraryBookCardData } from "@/components/library/book-card";

import { BookFormDialog } from "./components/book-form-dialog";
import { BooksShelf } from "./components/books-shelf";

export type LibraryBookListItem = LibraryBookCardData & {
  isActive?: boolean;
  fileSize?: number | null;
  updatedAt?: string;
};

type BibliothequeClientProps = {
  mode: LibraryAccessMode;
  organizationId: string;
  branchId: string;
  typebranch: string;
  initialBooks: LibraryBookListItem[];
};

export function BibliothequeClient({
  mode,
  organizationId,
  branchId,
  typebranch,
  initialBooks,
}: BibliothequeClientProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [cycle, setCycle] = useState<string>("all");
  const [subject, setSubject] = useState<string>("all");
  const [level, setLevel] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const taxonomy = useMemo(() => getLibraryTaxonomy(typebranch), [typebranch]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialBooks.filter((book) => {
      if (cycle !== "all" && book.cycle !== cycle) return false;
      if (subject !== "all" && book.subject !== subject) return false;
      if (level !== "all" && book.level !== level) return false;
      if (!q) return true;
      return (
        book.title.toLowerCase().includes(q) ||
        (book.author?.toLowerCase().includes(q) ?? false) ||
        (book.subject?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [initialBooks, query, cycle, subject, level]);

  const basePath = `/admin/organizations/${organizationId}/branches/${branchId}/bibliotheque`;

  const refresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <BranchPageShell
      title="Bibliothèque"
      description={
        mode === "manage"
          ? taxonomy.pageDescriptionManage
          : taxonomy.pageDescriptionRead
      }
      badge={
        <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-[10px]">
          <LibraryBig className="size-3" />
          {initialBooks.length} livre
          {initialBooks.length === 1 ? "" : "s"}
        </Badge>
      }
      actions={
        mode === "manage" ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link
                href={`/admin/organizations/${organizationId}/branches/${branchId}/settings/bibliotheque`}
              >
                <Cloud className="size-3.5" />
                Sources
              </Link>
            </Button>
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="gap-1.5"
              disabled={pending}
            >
              <Plus className="size-3.5" />
              Ajouter un livre
            </Button>
          </div>
        ) : null
      }
      contentClassName="space-y-4"
    >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher…"
              className="h-9 bg-background pl-8 text-sm"
            />
          </div>
          {taxonomy.cycles.length > 1 ? (
            <Select value={cycle} onValueChange={setCycle}>
              <SelectTrigger className="h-9 w-full bg-background sm:w-[160px]">
                <SelectValue placeholder="Cycle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les cycles</SelectItem>
                {taxonomy.cycles.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger className="h-9 w-full bg-background sm:w-[150px]">
              <SelectValue placeholder="Niveau" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les niveaux</SelectItem>
              {taxonomy.levels.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="h-9 w-full bg-background sm:w-[160px]">
              <SelectValue placeholder="Matière" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les matières</SelectItem>
              {taxonomy.subjects.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={
              initialBooks.length === 0
                ? "Aucun livre pour le moment"
                : "Aucun résultat"
            }
            description={
              mode === "manage"
                ? `Ajoutez un manuel PDF ou EPUB pour les ${taxonomy.readerPluralLower}.`
                : "Aucun manuel ne correspond à vos filtres."
            }
            action={
              mode === "manage" ? (
                <Button onClick={() => setCreateOpen(true)} className="gap-2">
                  <Plus className="size-4" />
                  Ajouter un livre
                </Button>
              ) : undefined
            }
          />
        ) : (
          <BooksShelf
            books={filtered}
            basePath={basePath}
            mode={mode}
            typebranch={typebranch}
            onChanged={refresh}
          />
        )}

        {mode === "manage" ? (
          <BookFormDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            mode="create"
            typebranch={typebranch}
            onSuccess={refresh}
          />
        ) : null}
    </BranchPageShell>
  );
}
