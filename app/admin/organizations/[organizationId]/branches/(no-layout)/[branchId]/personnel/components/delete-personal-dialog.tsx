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
import { IPersonnel } from "@/src/interfaces/Personnel";
import {
  archivePersonalAction,
  deletePersonnelPermanentlyAction,
} from "../personnel.action";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface DeletePersonalDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  personals: Row<IPersonnel>["original"][];
  /** Si true : suppression définitive (propriétaire uniquement). */
  permanent?: boolean;
}

export function DeletePersonalDialog({
  showTrigger = true,
  onSuccess,
  personals,
  permanent = false,
  ...props
}: DeletePersonalDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { refresh } = useRefresh();

  const handleConfirm = () => {
    startTransition(async () => {
      try {
        if (permanent) {
          const [result, error] = await deletePersonnelPermanentlyAction({
            ids: personals.map((p) => p.id),
          });
          if (error) {
            toast.error(error.message ?? "Erreur lors de la suppression");
            return;
          }
          if (!result?.ok) {
            toast.error(result?.message ?? "Erreur lors de la suppression");
            return;
          }
          toast.success(
            personals.length === 1
              ? "Personnel supprimé"
              : "Personnels supprimés",
          );
        } else {
          await archivePersonalAction({
            ids: personals.map((p) => p.id),
          });
          toast.success(
            personals.length === 1
              ? "Personnel archivé"
              : "Personnels archivés",
          );
        }

        onSuccess?.();
        refresh();
        props.onOpenChange?.(false);
      } catch {
        toast.error(
          permanent
            ? "Erreur lors de la suppression du personnel"
            : "Erreur lors de l'archivage du personnel",
        );
      }
    });
  };

  const count = personals.length;

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {permanent
              ? count === 1
                ? "Supprimer définitivement le personnel ?"
                : `Supprimer définitivement ${count} personnels ?`
              : count === 1
                ? "Archiver le personnel ?"
                : `Archiver ${count} personnels ?`}
          </DialogTitle>
          <DialogDescription>
            {permanent
              ? count === 1
                ? "Cette action est irréversible : pointages, absences et le compte seront effacés."
                : "Cette action est irréversible : toutes les données liées et les comptes seront effacés."
              : count === 1
                ? "Le personnel sera masqué des listes actives mais l'historique sera conservé."
                : "Ces personnels seront masqués des listes actives mais l'historique sera conservé."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:space-x-0">
          <DialogClose asChild>
            <Button variant="outline">Annuler</Button>
          </DialogClose>
          <Button
            aria-label={
              permanent ? "Supprimer définitivement" : "Archiver la sélection"
            }
            variant={permanent ? "destructive" : "outline"}
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending && (
              <IconReload
                className="mr-2 size-4 animate-spin"
                aria-hidden="true"
              />
            )}
            {permanent ? "Supprimer définitivement" : "Archiver"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
