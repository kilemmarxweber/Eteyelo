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
import { ISection } from "@/src/interfaces/Section";
import { archiveSectionAction } from "../section.action";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface DeleteSectionsDialogProps
  extends React.ComponentPropsWithoutRef<typeof Dialog> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  Sections: Row<ISection>["original"][];
}

export function DeleteSectionsDialog({
  showTrigger = true,
  onSuccess,
  Sections,
  ...props
}: DeleteSectionsDialogProps) {
  const [isArchivePending, startArchiveTransition] = React.useTransition();

  const { refresh } = useRefresh();
  const handleArchive = () => {
    startArchiveTransition(async () => {
      let hasError = false;
      for (const section of Sections) {
        const [, err] = await archiveSectionAction({
          id: section.id,
          codeSection: section.codeSection,
          nameSection: section.nameSection,
        });
        if (err) {
          toast.error(err.message ?? "Erreur lors de l'archivage");
          hasError = true;
        }
      }
      if (!hasError) {
        toast.success(
          Sections.length === 1 ? "Section archivée" : "Sections archivées",
        );
        refresh();
        onSuccess?.();
        props.onOpenChange?.(false);
      }
    });
  };

  const count = Sections.length;

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
              ? "Archiver la section ?"
              : `Archiver ${count} sections ?`}
          </DialogTitle>
          <DialogDescription>
            {count === 1
              ? "La section sera masquée des listes actives mais l'historique sera conservé."
              : "Ces sections seront masquées des listes actives mais l'historique sera conservé."}
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
