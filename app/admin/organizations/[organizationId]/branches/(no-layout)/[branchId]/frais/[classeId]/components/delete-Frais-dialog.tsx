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
import { IFrais } from "@/src/interfaces/Frais";
import {
  archiveFrais,
  deleteFraisPermanentlyAction,
} from "../../frais.action";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface DeleteFraissDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  Frais: Row<IFrais>["original"][];
  /** Si true : suppression définitive (propriétaire uniquement). */
  permanent?: boolean;
}

export function DeleteFraissDialog({
  showTrigger = true,
  onSuccess,
  Frais,
  permanent = false,
  ...props
}: DeleteFraissDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { refresh } = useRefresh();
  const count = Frais.length;

  const handleConfirm = () => {
    startTransition(async () => {
      let hasError = false;
      for (const frais of Frais) {
        const [, err] = permanent
          ? await deleteFraisPermanentlyAction({ id: frais.id })
          : await archiveFrais({ id: frais.id });
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
              ? "Frais supprimé"
              : "Frais supprimés"
            : count === 1
              ? "Frais désactivé"
              : "Frais désactivés",
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {permanent
              ? count === 1
                ? "Supprimer définitivement le frais ?"
                : `Supprimer définitivement ${count} frais ?`
              : count === 1
                ? "Désactiver le frais ?"
                : `Désactiver ${count} frais ?`}
          </DialogTitle>
          <DialogDescription>
            {permanent
              ? count === 1
                ? "Cette action est irréversible. Le frais sera effacé définitivement s'il n'a aucun paiement lié."
                : "Cette action est irréversible. Ces frais seront effacés définitivement s'ils n'ont aucun paiement lié."
              : count === 1
                ? "Le frais sera désactivé et masqué des listes actives mais l'historique sera conservé."
                : "Ces frais seront désactivés et masqués des listes actives mais l'historique sera conservé."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:space-x-0">
          <DialogClose asChild>
            <Button variant="outline">Annuler</Button>
          </DialogClose>
          <Button
            aria-label={
              permanent ? "Supprimer la sélection" : "Désactiver la sélection"
            }
            variant={permanent ? "destructive" : "outline"}
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
            {permanent ? "Supprimer définitivement" : "Désactiver"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
