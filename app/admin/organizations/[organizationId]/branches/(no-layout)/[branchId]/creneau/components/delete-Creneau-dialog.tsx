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
import { ICreneau } from "@/src/interfaces/creneau";
import { archiveCreneauAction } from "../creneau.action";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface DeleteCreneausDialogProps
  extends React.ComponentPropsWithoutRef<typeof Dialog> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  Creneaus: Row<ICreneau>["original"][];
}

export function DeleteCreneausDialog({
  showTrigger = true,
  onSuccess,
  Creneaus,
  ...props
}: DeleteCreneausDialogProps) {
  const [isArchivePending, startArchiveTransition] = React.useTransition();

  const { refresh } = useRefresh();
  const handleArchive = () => {
    startArchiveTransition(async () => {
      let hasError = false;
      for (const creneau of Creneaus) {
        const [, err] = await archiveCreneauAction(creneau);
        if (err) {
          toast.error(err.message ?? "Erreur lors de l'archivage");
          hasError = true;
        }
      }
      if (!hasError) {
        toast.success(
          Creneaus.length === 1
            ? "Vacation archivée"
            : "Vacations archivées",
        );
        refresh();
        onSuccess?.();
        props.onOpenChange?.(false);
      }
    });
  };

  const count = Creneaus.length;

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
              ? "Archiver la vacation ?"
              : `Archiver ${count} vacations ?`}
          </DialogTitle>
          <DialogDescription>
            {count === 1
              ? "La vacation sera masquée des listes actives mais l'historique sera conservé."
              : "Ces vacations seront masquées des listes actives mais l'historique sera conservé."}
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
