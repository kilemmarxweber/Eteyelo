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
import { IParent } from "@/src/interfaces/Parent";
import { archiveParentAction } from "../parent.action";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface DeleteParentDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  parents: Row<IParent>["original"][];
}

export function DeleteParentDialog({
  showTrigger = true,
  onSuccess,
  parents,
  ...props
}: DeleteParentDialogProps) {
  const [isArchivePending, startArchiveTransition] = React.useTransition();

  const { refresh } = useRefresh();
  const handleArchive = () => {
    startArchiveTransition(async () => {
      try {
        let hasArchived = false;
        for (const parent of parents) {
          const [result, error] = await archiveParentAction({
            id: parent.id,
          });

          if (error) {
            toast.error(error.message ?? "Erreur lors de l'archivage");
            continue;
          }

          if (result?.success) {
            hasArchived = true;
            toast.success(result.message ?? "Parent archivé");
          } else {
            toast.error(result?.message ?? "Erreur lors de l'archivage");
          }
        }
        if (hasArchived) {
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
            <IconArchive className="mr-2 size-4" aria-hidden="true" />
            Archiver ({count})
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {count === 1
              ? "Archiver le parent ?"
              : `Archiver ${count} parents ?`}
          </DialogTitle>
          <DialogDescription>
            {count === 1
              ? "Le parent sera masqué des listes actives mais l'historique sera conservé."
              : "Ces parents seront masqués des listes actives mais l'historique sera conservé."}
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
