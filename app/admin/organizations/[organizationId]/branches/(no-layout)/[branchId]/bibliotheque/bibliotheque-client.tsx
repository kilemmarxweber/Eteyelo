"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, LibraryBig, Plus, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LIBRARY_SUBJECTS } from "@/lib/library/schemas";
import type { LibraryAccessMode } from "@/lib/library/access";

import { BookCard, type LibraryBookCardData } from "@/components/library/book-card";
import { BookFormDialog } from "./components/book-form-dialog";
import { BooksAdminTable } from "./components/books-admin-table";

export type LibraryBookListItem = LibraryBookCardData & {
  isActive?: boolean;
  fileSize?: number | null;
  updatedAt?: string;
};

type BibliothequeClientProps = {
  mode: LibraryAccessMode;
  organizationId: string;
  branchId: string;
  initialBooks: LibraryBookListItem[];
};

export function BibliothequeClient({
  mode,
  organizationId,
  branchId,
  initialBooks,
}: BibliothequeClientProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [cycle, setCycle] = useState<string>("all");
  const [subject, setSubject] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialBooks.filter((book) => {
      if (cycle !== "all" && book.cycle !== cycle) return false;
      if (subject !== "all" && book.subject !== subject) return false;
      if (!q) return true;
      return (
        book.title.toLowerCase().includes(q) ||
        (book.author?.toLowerCase().includes(q) ?? false) ||
        (book.subject?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [initialBooks, query, cycle, subject]);

  const basePath = `/admin/organizations/${organizationId}/branches/${branchId}/bibliotheque`;

  const refresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Bibliothèque"
        description={
          mode === "manage"
            ? "Gérez les manuels PDF et EPUB réservés aux élèves (lecture seule)."
            : "Consultez vos manuels scolaires en lecture seule."
        }
        badge={
          <Badge variant="secondary" className="gap-1">
            <LibraryBig className="size-3.5" />
            {initialBooks.length} livre{initialBooks.length === 1 ? "" : "s"}
          </Badge>
        }
        actions={
          mode === "manage" ? (
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="size-4" />
              Ajouter un livre
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un titre, auteur, matière…"
            className="pl-9"
          />
        </div>
        <Select value={cycle} onValueChange={setCycle}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Cycle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les cycles</SelectItem>
            <SelectItem value="PRIMAIRE">Primaire</SelectItem>
            <SelectItem value="SECONDAIRE">Secondaire</SelectItem>
            <SelectItem value="HUMANITES">Humanités</SelectItem>
          </SelectContent>
        </Select>
        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Matière" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les matières</SelectItem>
            {LIBRARY_SUBJECTS.map((item) => (
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
              ? "Ajoutez un manuel PDF ou EPUB pour le rendre disponible aux élèves."
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
      ) : mode === "manage" ? (
        <BooksAdminTable
          books={filtered}
          basePath={basePath}
          onChanged={refresh}
          pending={pending}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              href={`${basePath}/${book.id}`}
            />
          ))}
        </div>
      )}

      {mode === "manage" ? (
        <BookFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          mode="create"
          onSuccess={refresh}
        />
      ) : null}
    </div>
  );
}
