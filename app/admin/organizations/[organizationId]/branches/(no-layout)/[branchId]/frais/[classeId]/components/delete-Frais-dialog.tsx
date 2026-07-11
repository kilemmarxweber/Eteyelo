"use client";

import * as React from "react";
import { IconArchive, IconReload } from "@tabler/icons-react";
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
import { archiveFrais } from "../../frais.action";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface DeleteFraissDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  Frais: Row<IFrais>["original"][];
}

export function DeleteFraissDialog({
  showTrigger = true,
  onSuccess,
  Frais,
  ...props
}: DeleteFraissDialogProps) {
  const [isArchivePending, startArchiveTransition] = React.useTransition();

  const { refresh } = useRefresh();
  const handleArchive = () => {
    startArchiveTransition(async () => {
      let hasError = false;
      for (const frais of Frais) {
        const [, err] = await archiveFrais({
          id: frais.id,
        });
        if (err) {
          toast.error(err.message ?? "Erreur lors de la désactivation");
          hasError = true;
        }
      }
      if (!hasError) {
        toast.success(
          Frais.length === 1 ? "Frais désactivé" : "Frais désactivés",
        );
        refresh();
        onSuccess?.();
        props.onOpenChange?.(false);
      }
    });
  };

  const count = Frais.length;

  return (
    <Dialog {...props}>
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <IconArchive className="mr-2 size-4" aria-hidden="true" />
            Désactiver ({count})
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {count === 1
              ? "Désactiver le frais ?"
              : `Désactiver ${count} frais ?`}
          </DialogTitle>
          <DialogDescription>
            {count === 1
              ? "Le frais sera désactivé et masqué des listes actives mais l'historique sera conservé."
              : "Ces frais seront désactivés et masqués des listes actives mais l'historique sera conservé."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:space-x-0">
          <DialogClose asChild>
            <Button variant="outline">Annuler</Button>
          </DialogClose>
          <Button
            aria-label="Désactiver la sélection"
            variant="outline"
            onClick={handleArchive}
            disabled={isArchivePending}
          >
            {isArchivePending && (
              <IconReload
                className="mr-2 size-4 animate-spin"
                aria-hidden="true"
              />
            )}
            Désactiver
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
