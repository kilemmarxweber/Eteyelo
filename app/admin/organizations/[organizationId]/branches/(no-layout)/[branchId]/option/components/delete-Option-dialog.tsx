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
import { IOption } from "@/src/interfaces/Option";
import { archiveOptionAction } from "../option.action";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface DeleteOptionsDialogProps
  extends React.ComponentPropsWithoutRef<typeof Dialog> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  Options: Row<IOption>["original"][];
}

export function DeleteOptionsDialog({
  showTrigger = true,
  onSuccess,
  Options,
  ...props
}: DeleteOptionsDialogProps) {
  const [isArchivePending, startArchiveTransition] = useTransition();

  const { refresh } = useRefresh();
  const handleArchive = () => {
    startArchiveTransition(async () => {
      let hasError = false;
      for (const option of Options) {
        const [, err] = await archiveOptionAction({
          id: option.id,
          codeOption: option.codeOption,
          nameOption: option.nameOption,
        });
        if (err) {
          toast.error(err.message ?? "Erreur lors de l'archivage");
          hasError = true;
        }
      }
      if (!hasError) {
        toast.success(
          Options.length === 1 ? "Option archivée" : "Options archivées",
        );
        refresh();
        onSuccess?.();
        props.onOpenChange?.(false);
      }
    });
  };

  const count = Options.length;

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
              ? "Archiver l'option ?"
              : `Archiver ${count} options ?`}
          </DialogTitle>
          <DialogDescription>
            {count === 1
              ? "L'option sera masquée des listes actives mais l'historique sera conservé."
              : "Ces options seront masquées des listes actives mais l'historique sera conservé."}
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
