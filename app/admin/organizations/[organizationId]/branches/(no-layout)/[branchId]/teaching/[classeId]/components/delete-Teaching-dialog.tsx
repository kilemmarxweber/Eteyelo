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
import { ITeaching } from "@/src/interfaces/Teaching";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { archiveTeachingAction } from "../../teaching.action";

interface DeleteTeachingsDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  teaches: Row<ITeaching>["original"][];
}

export function DeleteTeachingsDialog({
  showTrigger = true,
  onSuccess,
  teaches,
  ...props
}: DeleteTeachingsDialogProps) {
  const [isArchivePending, startArchiveTransition] = React.useTransition();

  const { refresh } = useRefresh();
  const handleArchive = () => {
    startArchiveTransition(async () => {
      let hasError = false;
      for (const teache of teaches) {
        const [, err] = await archiveTeachingAction({
          id: teache.id,
        });
        if (err) {
          toast.error(err.message ?? "Erreur lors de la désactivation");
          hasError = true;
        }
      }
      if (!hasError) {
        toast.success(
          teaches.length === 1
            ? "Affectation désactivée"
            : "Affectations désactivées",
        );
        refresh();
        onSuccess?.();
        props.onOpenChange?.(false);
      }
    });
  };

  const count = teaches.length;

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
              ? "Désactiver l'affectation ?"
              : `Désactiver ${count} affectations ?`}
          </DialogTitle>
          <DialogDescription>
            {count === 1
              ? "L'affectation sera désactivée et masquée des listes actives mais l'historique sera conservé."
              : "Ces affectations seront désactivées et masquées des listes actives mais l'historique sera conservé."}
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
