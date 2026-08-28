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
import { IParent } from "@/src/interfaces/Parent";
import {
  archiveParentAction,
  deleteParentPermanentlyAction,
} from "../parent.action";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface DeleteParentDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  parents: Row<IParent>["original"][];
  /** Si true : retire de la branche (garde le membre org). */
  permanent?: boolean;
}

export function DeleteParentDialog({
  showTrigger = true,
  onSuccess,
  parents,
  permanent = false,
  ...props
}: DeleteParentDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { refresh } = useRefresh();

  const handleConfirm = () => {
    startTransition(async () => {
      try {
        let hasDone = false;

        for (const parent of parents) {
          const [result, error] = permanent
            ? await deleteParentPermanentlyAction({ id: parent.id })
            : await archiveParentAction({
                id: parent.id,
              });

          if (error) {
            toast.error(
              error.message ??
                (permanent
                  ? "Erreur lors de la suppression"
                  : "Erreur lors de l'archivage"),
            );
            continue;
          }

          if (result && ("ok" in result ? result.ok : result.success)) {
            hasDone = true;
            toast.success(
              result.message ??
                (permanent
                  ? "Parent désactivé dans la branche"
                  : "Parent archivé"),
            );
          } else {
            toast.error(
              result?.message ??
                (permanent
                  ? "Erreur lors de la suppression"
                  : "Erreur lors de l'archivage"),
            );
          }
        }

        if (hasDone) {
          refresh();
          onSuccess?.();
          props.onOpenChange?.(false);
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Erreur serveur";
        toast.error(message);
      }
    });
  };

  const count = parents.length;

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
                ? "Désactiver le parent dans cette branche ?"
                : `Désactiver ${count} parents dans cette branche ?`
              : count === 1
                ? "Archiver le parent ?"
                : `Archiver ${count} parents ?`}
          </DialogTitle>
          <DialogDescription>
            {permanent
              ? count === 1
                ? "Il ne sera plus visible dans cette branche, mais restera membre de l'organisation. Tout l'historique (paiements, etc.) est conservé pour les rapports. Ses autres branches ne sont pas affectées."
                : "Ils ne seront plus visibles dans cette branche, mais resteront membres de l'organisation. L'historique est conservé pour les rapports."
              : count === 1
                ? "Le parent sera désactivé dans cette branche seulement. L'historique reste disponible pour les rapports ; les autres branches ne sont pas affectées."
                : "Ces parents seront désactivés dans cette branche seulement. L'historique reste disponible pour les rapports."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:space-x-0">
          <DialogClose asChild>
            <Button variant="outline">Annuler</Button>
          </DialogClose>
          <Button
            aria-label={
              permanent ? "Désactiver dans la branche" : "Archiver la sélection"
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
            {permanent ? "Désactiver" : "Archiver"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
