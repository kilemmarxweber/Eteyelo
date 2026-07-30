"use client";

import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { LibraryAccessMode } from "@/lib/library/access";
import { BookCard } from "@/components/library/book-card";

import {
  deleteLibraryBookAction,
  setLibraryBookActiveAction,
} from "../bibliotheque.action";
import type { LibraryBookListItem } from "../bibliotheque-client";
import { BookFormDialog } from "./book-form-dialog";

type BooksShelfProps = {
  books: LibraryBookListItem[];
  basePath: string;
  mode: LibraryAccessMode;
  typebranch: string;
  onChanged: () => void;
};

/** Rayonnage de livres en cartes (remplace l’ancienne table admin). */
export function BooksShelf({
  books,
  basePath,
  mode,
  typebranch,
  onChanged,
}: BooksShelfProps) {
  const isManage = mode === "manage";
  const [editBook, setEditBook] = useState<LibraryBookListItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggleActive(book: LibraryBookListItem) {
    setBusyId(book.id);
    try {
      const [, err] = await setLibraryBookActiveAction({
        id: book.id,
        isActive: !(book.isActive ?? true),
      });
      if (err) throw new Error(err.message);
      toast.success(
        book.isActive ? "Livre masqué pour les élèves" : "Livre activé",
      );
      onChanged();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Action impossible",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setBusyId(deleteId);
    try {
      const [, err] = await deleteLibraryBookAction({ id: deleteId });
      if (err) throw new Error(err.message);
      toast.success("Livre supprimé");
      setDeleteId(null);
      onChanged();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Suppression impossible",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-border/80 bg-gradient-to-b from-muted/40 via-background to-background p-3 shadow-inner sm:p-4 dark:from-muted/20">
        <div className="mb-3 flex items-end justify-between gap-2 px-0.5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Rayonnage
            </p>
            <p className="text-[11px] text-muted-foreground">
              {books.length} ouvrage{books.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {books.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              href={`${basePath}/${book.id}`}
              manage={
                isManage
                  ? {
                      busy: busyId === book.id,
                      onEdit: () => setEditBook(book),
                      onToggleActive: () => void toggleActive(book),
                      onDelete: () => setDeleteId(book.id),
                    }
                  : undefined
              }
            />
          ))}
        </div>
      </div>

      {isManage ? (
        <>
          <BookFormDialog
            open={Boolean(editBook)}
            onOpenChange={(open) => {
              if (!open) setEditBook(null);
            }}
            mode="edit"
            typebranch={typebranch}
            initialData={editBook ?? undefined}
            onSuccess={onChanged}
          />

          <AlertDialog
            open={Boolean(deleteId)}
            onOpenChange={(open) => {
              if (!open) setDeleteId(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer ce livre ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Le fichier sera retiré définitivement. Les élèves ne pourront
                  plus le consulter.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={() => void confirmDelete()}>
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </>
  );
}
