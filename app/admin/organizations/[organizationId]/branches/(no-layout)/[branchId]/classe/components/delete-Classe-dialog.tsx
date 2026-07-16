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
import { IClasse } from "@/src/interfaces/Classe";
import { archiveClasseAction } from "../classe.action";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface DeleteClassesDialogProps
  extends React.ComponentPropsWithoutRef<typeof Dialog> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  Classes: Row<IClasse>["original"][];
}

export function DeleteClassesDialog({
  showTrigger = true,
  onSuccess,
  Classes,
  ...props
}: DeleteClassesDialogProps) {
  const [isArchivePending, startArchiveTransition] = useTransition();

  const { refresh } = useRefresh();
  const handleArchive = () => {
    startArchiveTransition(async () => {
      let hasError = false;
      for (const classe of Classes) {
        const [, err] = await archiveClasseAction({
          id: classe.id,
          codeClasse: classe.codeClasse,
          nameClasse: classe.nameClasse,
        });
        if (err) {
          toast.error(err.message ?? "Erreur lors de l'archivage");
          hasError = true;
        }
      }
      if (!hasError) {
        toast.success(
          Classes.length === 1 ? "Classe archivée" : "Classes archivées",
        );
        refresh();
        onSuccess?.();
        props.onOpenChange?.(false);
      }
    });
  };

  const count = Classes.length;

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
      <DialogContent
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {count === 1
              ? "Archiver la classe ?"
              : `Archiver ${count} classes ?`}
          </DialogTitle>
          <DialogDescription>
            {count === 1
              ? "La classe sera masquée des listes actives mais l'historique sera conservé."
              : "Ces classes seront masquées des listes actives mais l'historique sera conservé."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:space-x-0">
          <DialogClose asChild>
            <Button variant="outline">Annuler</Button>
          </DialogClose>
          <Button
            aria-label="Archiver la sélection"
            variant="destructive"
            onClick={handleArchive}
            disabled={isArchivePending}
          >
            {isArchivePending ? (
              <IconReload
                className="mr-2 size-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <IconArchive className="mr-2 size-4" aria-hidden="true" />
            )}
            Archiver
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
