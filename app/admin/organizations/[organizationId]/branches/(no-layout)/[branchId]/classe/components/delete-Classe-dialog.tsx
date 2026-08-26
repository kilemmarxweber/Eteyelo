"use client";

import { useAppTransition as useTransition } from "@/hooks/use-app-transition";

import * as React from "react";
import { IconArchive, IconReload, IconTrash } from "@tabler/icons-react";
import { type Row } from "@tanstack/react-table";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { IClasse } from "@/src/interfaces/Classe";
import {
  archiveClasseAction,
  deleteClassePermanentlyAction,
} from "../classe.action";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface DeleteClassesDialogProps
  extends React.ComponentPropsWithoutRef<typeof Dialog> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  Classes: Row<IClasse>["original"][];
  permanent?: boolean;
}

export function DeleteClassesDialog({
  showTrigger = true,
  onSuccess,
  Classes,
  permanent = false,
  ...props
}: DeleteClassesDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { refresh } = useRefresh();

  const handleConfirm = () => {
    startTransition(async () => {
      let hasError = false;
      for (const classe of Classes) {
        const [, err] = permanent
          ? await deleteClassePermanentlyAction({ id: classe.id })
          : await archiveClasseAction({
              id: classe.id,
              codeClasse: classe.codeClasse,
              nameClasse: classe.nameClasse,
            });
        if (err) {
          toast.error(
            err.message ??
              (permanent
                ? "Erreur lors de la suppression"
                : "Erreur lors de l'archivage"),
          );
          hasError = true;
        }
      }
      if (!hasError) {
        toast.success(
          permanent
            ? Classes.length === 1
              ? "Classe supprimée"
              : "Classes supprimées"
            : Classes.length === 1
              ? "Classe archivée"
              : "Classes archivées",
        );
        refresh();
        onSuccess?.();
        props.onOpenChange?.(false);
      }
    });
  };

  const count = Classes.length;

  return (
    <Dialog {...props}>
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            {permanent ? (
              <IconTrash className="mr-2 size-4" aria-hidden="true" />
            ) : (
              <IconArchive className="mr-2 size-4" aria-hidden="true" />
            )}
            {permanent ? `Supprimer (${count})` : `Archiver (${count})`}
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {permanent
              ? count === 1
                ? "Supprimer la classe ?"
                : `Supprimer ${count} classes ?`
              : count === 1
                ? "Archiver la classe ?"
                : `Archiver ${count} classes ?`}
          </DialogTitle>
          <DialogDescription>
            {permanent
              ? count === 1
                ? "Cette action est irréversible. La classe sera effacée définitivement."
                : "Cette action est irréversible. Ces classes seront effacées définitivement."
              : count === 1
                ? "La classe sera masquée des listes actives mais l'historique sera conservé."
                : "Ces classes seront masquées des listes actives mais l'historique sera conservé."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:space-x-0">
          <DialogClose asChild>
            <Button variant="outline">Annuler</Button>
          </DialogClose>
          <Button
            aria-label={permanent ? "Supprimer la sélection" : "Archiver la sélection"}
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? (
              <IconReload
                className="mr-2 size-4 animate-spin"
                aria-hidden="true"
              />
            ) : permanent ? (
              <IconTrash className="mr-2 size-4" aria-hidden="true" />
            ) : (
              <IconArchive className="mr-2 size-4" aria-hidden="true" />
            )}
            {permanent ? "Supprimer" : "Archiver"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
