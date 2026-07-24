"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Pencil, Eye, EyeOff, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

import { LIBRARY_CYCLE_LABELS } from "@/lib/library/taxonomy";
import {
  deleteLibraryBookAction,
  setLibraryBookActiveAction,
} from "../bibliotheque.action";
import type { LibraryBookListItem } from "../bibliotheque-client";
import { BookFormDialog } from "./book-form-dialog";

function formatSize(bytes?: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

type BooksAdminTableProps = {
  books: LibraryBookListItem[];
  basePath: string;
  onChanged: () => void;
  pending?: boolean;
  typebranch: string;
};

export function BooksAdminTable({
  books,
  basePath,
  onChanged,
  typebranch,
}: BooksAdminTableProps) {
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
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Livre</TableHead>
              <TableHead className="hidden md:table-cell">Cycle</TableHead>
              <TableHead className="hidden lg:table-cell">Matière</TableHead>
              <TableHead>Format</TableHead>
              <TableHead className="hidden sm:table-cell">Taille</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {books.map((book) => (
              <TableRow key={book.id} className="align-middle">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="size-12 shrink-0 overflow-hidden rounded-md bg-muted">
                      {book.coverImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={book.coverImage}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center text-[10px] font-semibold text-muted-foreground">
                          {book.fileType}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{book.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {book.author || "Sans auteur"}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {book.cycle
                    ? (LIBRARY_CYCLE_LABELS[
                        book.cycle as keyof typeof LIBRARY_CYCLE_LABELS
                      ] ?? book.cycle)
                    : "—"}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {book.subject || "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{book.fileType}</Badge>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-muted-foreground">
                  {formatSize(book.fileSize)}
                </TableCell>
                <TableCell>
                  <Badge variant={book.isActive ? "default" : "outline"}>
                    {book.isActive ? "Actif" : "Inactif"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={busyId === book.id}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`${basePath}/${book.id}`}>
                          <Eye className="mr-2 size-4" />
                          Aperçu / Lire
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setEditBook(book)}>
                        <Pencil className="mr-2 size-4" />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleActive(book)}>
                        <EyeOff className="mr-2 size-4" />
                        {book.isActive ? "Désactiver" : "Activer"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteId(book.id)}
                      >
                        <Trash2 className="mr-2 size-4" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

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
              Le fichier sera retiré définitivement. Les élèves ne pourront plus
              le consulter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
