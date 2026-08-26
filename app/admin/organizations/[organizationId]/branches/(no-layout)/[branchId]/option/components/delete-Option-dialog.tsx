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
import { IOption } from "@/src/interfaces/Option";
import {
  archiveOptionAction,
  deleteOptionPermanentlyAction,
} from "../option.action";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface DeleteOptionsDialogProps
  extends React.ComponentPropsWithoutRef<typeof Dialog> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  Options: Row<IOption>["original"][];
  permanent?: boolean;
}

function optionClassesCount(option: IOption) {
  return option.classesCount ?? option.classes?.length ?? 0;
}

export function DeleteOptionsDialog({
  showTrigger = true,
  onSuccess,
  Options,
  permanent = false,
  ...props
}: DeleteOptionsDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { refresh } = useRefresh();

  const count = Options.length;
  const blockedCount = Options.reduce(
    (total, option) => total + optionClassesCount(option),
    0,
  );
  const blocked = permanent && blockedCount > 0;

  const handleConfirm = () => {
    if (blocked) return;
    startTransition(async () => {
      let hasError = false;
      for (const option of Options) {
        const [, err] = permanent
          ? await deleteOptionPermanentlyAction({ id: option.id })
          : await archiveOptionAction({
              id: option.id,
              codeOption: option.codeOption,
              nameOption: option.nameOption,
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
              ? "Option supprimée"
              : "Options supprimées"
            : count === 1
              ? "Option archivée"
              : "Options archivées",
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
                  ? "Supprimer l'option ?"
                  : `Supprimer ${count} options ?`
                : count === 1
                  ? "Archiver l'option ?"
                  : `Archiver ${count} options ?`}
          </DialogTitle>
          <DialogDescription>
            {blocked
              ? count === 1
                ? `Cette option a encore ${blockedCount} classe${blockedCount > 1 ? "s" : ""}. Supprimez d'abord ${blockedCount > 1 ? "ces classes" : "cette classe"} avant de supprimer l'option.`
                : `Ces options ont encore ${blockedCount} classe${blockedCount > 1 ? "s" : ""} liée${blockedCount > 1 ? "s" : ""}. Supprimez d'abord ces classes avant de supprimer les options.`
              : permanent
                ? count === 1
                  ? "Cette action est irréversible. L'option sera effacée définitivement."
                  : "Cette action est irréversible. Ces options seront effacées définitivement."
                : count === 1
                  ? "L'option sera masquée des listes actives mais l'historique sera conservé."
                  : "Ces options seront masquées des listes actives mais l'historique sera conservé."}
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
