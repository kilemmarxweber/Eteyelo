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
import { ISection } from "@/src/interfaces/Section";
import {
  archiveSectionAction,
  deleteSectionPermanentlyAction,
} from "../section.action";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface DeleteSectionsDialogProps
  extends React.ComponentPropsWithoutRef<typeof Dialog> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  Sections: Row<ISection>["original"][];
  permanent?: boolean;
}

function sectionOptionsCount(section: ISection) {
  return section.optionsCount ?? section.option?.length ?? 0;
}

export function DeleteSectionsDialog({
  showTrigger = true,
  onSuccess,
  Sections,
  permanent = false,
  ...props
}: DeleteSectionsDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { refresh } = useRefresh();

  const count = Sections.length;
  const blockedCount = Sections.reduce(
    (total, section) => total + sectionOptionsCount(section),
    0,
  );
  const blocked = permanent && blockedCount > 0;

  const handleConfirm = () => {
    if (blocked) return;
    startTransition(async () => {
      let hasError = false;
      for (const section of Sections) {
        const [, err] = permanent
          ? await deleteSectionPermanentlyAction({ id: section.id })
          : await archiveSectionAction({
              id: section.id,
              codeSection: section.codeSection,
              nameSection: section.nameSection,
            });
        if (err) {
          toast.error(
            err.message ??
              (permanent
                ? "Erreur lors de la suppression"
                : "Erreur lors de l'archivage"),
          );
          hasError = true;
        }
      }
      if (!hasError) {
        toast.success(
          permanent
            ? count === 1
              ? "Section supprimée"
              : "Sections supprimées"
            : count === 1
              ? "Section archivée"
              : "Sections archivées",
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
            {permanent ? `Supprimer (${count})` : `Archiver (${count})`}
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {blocked
              ? "Impossible de supprimer"
              : permanent
                ? count === 1
                  ? "Supprimer la section ?"
                  : `Supprimer ${count} sections ?`
                : count === 1
                  ? "Archiver la section ?"
                  : `Archiver ${count} sections ?`}
          </DialogTitle>
          <DialogDescription>
            {blocked
              ? count === 1
                ? `Cette section a encore ${blockedCount} option${blockedCount > 1 ? "s" : ""}. Supprimez d'abord ${blockedCount > 1 ? "ces options" : "cette option"} avant de supprimer la section.`
                : `Ces sections ont encore ${blockedCount} option${blockedCount > 1 ? "s" : ""} liée${blockedCount > 1 ? "s" : ""}. Supprimez d'abord ces options avant de supprimer les sections.`
              : permanent
                ? count === 1
                  ? "Cette action est irréversible. La section sera effacée définitivement."
                  : "Cette action est irréversible. Ces sections seront effacées définitivement."
                : count === 1
                  ? "La section sera masquée des listes actives mais l'historique sera conservé."
                  : "Ces sections seront masquées des listes actives mais l'historique sera conservé."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:space-x-0">
          <DialogClose asChild>
            <Button variant="outline">{blocked ? "Fermer" : "Annuler"}</Button>
          </DialogClose>
          {blocked ? null : (
            <Button
              aria-label={
                permanent ? "Supprimer la sélection" : "Archiver la sélection"
              }
              variant="destructive"
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
              {permanent ? "Supprimer" : "Archiver"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
