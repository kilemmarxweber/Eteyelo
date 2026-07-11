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
import { ICours } from "@/src/interfaces/Cours";
import { archiveCoursAction } from "../../cours/cours.action";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface DeleteCoursDialogProps
  extends React.ComponentPropsWithoutRef<typeof Dialog> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  Cours: Row<ICours>["original"][];
}

export function DeleteCoursDialog({
  showTrigger = true,
  onSuccess,
  Cours,
  ...props
}: DeleteCoursDialogProps) {
  const [isArchivePending, startArchiveTransition] = React.useTransition();

  const { refresh } = useRefresh();
  const handleArchive = () => {
    startArchiveTransition(async () => {
      let hasError = false;
      for (const cours of Cours) {
        const [, err] = await archiveCoursAction({
          id: cours.id,
          codeCours: cours.codeCours,
          nameCours: cours.codeCours,
        });
        if (err) {
          toast.error(err.message ?? "Erreur lors de la désactivation");
          hasError = true;
        }
      }
      if (!hasError) {
        toast.success(
          Cours.length === 1 ? "Cours désactivé" : "Cours désactivés",
        );
        refresh();
        onSuccess?.();
        props.onOpenChange?.(false);
      }
    });
  };

  const count = Cours.length;

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
              ? "Désactiver le cours ?"
              : `Désactiver ${count} cours ?`}
          </DialogTitle>
          <DialogDescription>
            {count === 1
              ? "Le cours sera désactivé et masqué des listes actives mais l'historique sera conservé."
              : "Ces cours seront désactivés et masqués des listes actives mais l'historique sera conservé."}
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
