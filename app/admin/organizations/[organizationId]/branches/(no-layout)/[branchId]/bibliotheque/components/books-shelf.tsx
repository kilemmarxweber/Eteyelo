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

/** Grille compacte de livres. */
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
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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
