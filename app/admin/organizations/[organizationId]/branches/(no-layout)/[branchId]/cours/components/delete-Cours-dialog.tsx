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
import { ICours } from "@/src/interfaces/Cours";
import {
  archiveCoursAction,
  deleteCoursPermanentlyAction,
} from "../../cours/cours.action";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface DeleteCoursDialogProps
  extends React.ComponentPropsWithoutRef<typeof Dialog> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  Cours: Row<ICours>["original"][];
  permanent?: boolean;
}

function coursTeachingsCount(cours: ICours) {
  return cours.teachingsCount ?? 0;
}

export function DeleteCoursDialog({
  showTrigger = true,
  onSuccess,
  Cours,
  permanent = false,
  ...props
}: DeleteCoursDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { refresh } = useRefresh();

  const count = Cours.length;
  const blockedCount = Cours.reduce(
    (total, cours) => total + coursTeachingsCount(cours),
    0,
  );
  const blocked = permanent && blockedCount > 0;

  const handleConfirm = () => {
    if (blocked) return;
    startTransition(async () => {
      let hasError = false;
      for (const cours of Cours) {
        const [, err] = permanent
          ? await deleteCoursPermanentlyAction({ id: cours.id })
          : await archiveCoursAction({
              id: cours.id,
              codeCours: cours.codeCours,
              nameCours: cours.nameCours,
            });
        if (err) {
          toast.error(
            err.message ??
              (permanent
                ? "Erreur lors de la suppression"
                : "Erreur lors de la désactivation"),
          );
          hasError = true;
        }
      }
      if (!hasError) {
        toast.success(
          permanent
            ? count === 1
              ? "Cours supprimé"
              : "Cours supprimés"
            : count === 1
              ? "Cours désactivé"
              : "Cours désactivés",
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
            {permanent ? `Supprimer (${count})` : `Désactiver (${count})`}
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
                  ? "Supprimer le cours ?"
                  : `Supprimer ${count} cours ?`
                : count === 1
                  ? "Désactiver le cours ?"
                  : `Désactiver ${count} cours ?`}
          </DialogTitle>
          <DialogDescription>
            {blocked
              ? count === 1
                ? `Ce cours a encore ${blockedCount} affectation${blockedCount > 1 ? "s" : ""}. Supprimez d'abord ${blockedCount > 1 ? "ces affectations" : "cette affectation"} avant de supprimer le cours.`
                : `Ces cours ont encore ${blockedCount} affectation${blockedCount > 1 ? "s" : ""} liée${blockedCount > 1 ? "s" : ""}. Supprimez d'abord ces affectations avant de supprimer les cours.`
              : permanent
                ? count === 1
                  ? "Cette action est irréversible. Le cours sera effacé définitivement."
                  : "Cette action est irréversible. Ces cours seront effacés définitivement."
                : count === 1
                  ? "Le cours sera désactivé et masqué des listes actives mais l'historique sera conservé."
                  : "Ces cours seront désactivés et masqués des listes actives mais l'historique sera conservé."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:space-x-0">
          <DialogClose asChild>
            <Button variant="outline">{blocked ? "Fermer" : "Annuler"}</Button>
          </DialogClose>
          {blocked ? null : (
            <Button
              aria-label={
                permanent
                  ? "Supprimer la sélection"
                  : "Désactiver la sélection"
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
              {permanent ? "Supprimer" : "Désactiver"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
