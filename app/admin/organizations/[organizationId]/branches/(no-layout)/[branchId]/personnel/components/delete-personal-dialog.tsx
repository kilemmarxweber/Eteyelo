"use client";

import { useAppTransition as useTransition } from "@/hooks/use-app-transition";

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
import { IPersonnel } from "@/src/interfaces/Personnel";
import { archivePersonalAction } from "../personnel.action";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface DeletePersonalDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  personals: Row<IPersonnel>["original"][];
}

export function DeletePersonalDialog({
  showTrigger = true,
  onSuccess,
  personals,
  ...props
}: DeletePersonalDialogProps) {
  const [isArchivePending, startArchiveTransition] = useTransition();

  const { refresh } = useRefresh();
  const handleArchive = () => {
    startArchiveTransition(async () => {
      try {
        await archivePersonalAction({
          ids: personals.map((p) => p.id),
        });

        toast.success(
          personals.length === 1
            ? "Personnel archivé"
            : "Personnels archivés",
        );
        onSuccess?.();
        refresh();
        props.onOpenChange?.(false);
      } catch {
        toast.error("Erreur lors de l'archivage du personnel");
      }
    });
  };

  const count = personals.length;

  return (
    <Dialog {...props}>
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <IconArchive className="mr-2 size-4" aria-hidden="true" />
            Archiver ({count})
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {count === 1
              ? "Archiver le personnel ?"
              : `Archiver ${count} personnels ?`}
          </DialogTitle>
          <DialogDescription>
            {count === 1
              ? "Le personnel sera masqué des listes actives mais l'historique sera conservé."
              : "Ces personnels seront masqués des listes actives mais l'historique sera conservé."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:space-x-0">
          <DialogClose asChild>
            <Button variant="outline">Annuler</Button>
          </DialogClose>
          <Button
            aria-label="Archiver la sélection"
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
            Archiver
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
