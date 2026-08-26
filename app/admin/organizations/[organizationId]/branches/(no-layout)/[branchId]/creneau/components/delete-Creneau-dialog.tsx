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
import { ICreneau } from "@/src/interfaces/creneau";
import {
  archiveCreneauAction,
  deleteCreneauPermanentlyAction,
} from "../creneau.action";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface DeleteCreneausDialogProps
  extends React.ComponentPropsWithoutRef<typeof Dialog> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  Creneaus: Row<ICreneau>["original"][];
  permanent?: boolean;
}

function creneauClassesCount(creneau: ICreneau) {
  return creneau.classesCount ?? 0;
}

export function DeleteCreneausDialog({
  showTrigger = true,
  onSuccess,
  Creneaus,
  permanent = false,
  ...props
}: DeleteCreneausDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { refresh } = useRefresh();

  const count = Creneaus.length;
  const blockedCount = Creneaus.reduce(
    (total, creneau) => total + creneauClassesCount(creneau),
    0,
  );
  const blocked = permanent && blockedCount > 0;

  const handleConfirm = () => {
    if (blocked) return;
    startTransition(async () => {
      let hasError = false;
      for (const creneau of Creneaus) {
        const [, err] = permanent
          ? await deleteCreneauPermanentlyAction({ id: creneau.id })
          : await archiveCreneauAction(creneau);
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
            ? count === 1
              ? "Vacation supprimée"
              : "Vacations supprimées"
            : count === 1
              ? "Vacation archivée"
              : "Vacations archivées",
        );
        refresh();
        onSuccess?.();
        props.onOpenChange?.(false);
      }
    });
  };

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
            {blocked
              ? "Impossible de supprimer"
              : permanent
                ? count === 1
                  ? "Supprimer la vacation ?"
                  : `Supprimer ${count} vacations ?`
                : count === 1
                  ? "Archiver la vacation ?"
                  : `Archiver ${count} vacations ?`}
          </DialogTitle>
          <DialogDescription>
            {blocked
              ? count === 1
                ? `Cette vacation a encore ${blockedCount} classe${blockedCount > 1 ? "s" : ""}. Supprimez d'abord ${blockedCount > 1 ? "ces classes" : "cette classe"} avant de supprimer la vacation.`
                : `Ces vacations ont encore ${blockedCount} classe${blockedCount > 1 ? "s" : ""} liée${blockedCount > 1 ? "s" : ""}. Supprimez d'abord ces classes avant de supprimer les vacations.`
              : permanent
                ? count === 1
                  ? "Cette action est irréversible. La vacation sera effacée définitivement."
                  : "Cette action est irréversible. Ces vacations seront effacées définitivement."
                : count === 1
                  ? "La vacation sera masquée des listes actives mais l'historique sera conservé."
                  : "Ces vacations seront masquées des listes actives mais l'historique sera conservé."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:space-x-0">
          <DialogClose asChild>
            <Button variant="outline">{blocked ? "Fermer" : "Annuler"}</Button>
          </DialogClose>
          {blocked ? null : (
            <Button
              aria-label={
                permanent ? "Supprimer la sélection" : "Archiver la sélection"
              }
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
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
