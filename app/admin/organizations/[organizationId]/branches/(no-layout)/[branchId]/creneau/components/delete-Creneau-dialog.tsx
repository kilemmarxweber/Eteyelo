"use client";

import { useAppTransition as useTransition } from "@/hooks/use-app-transition";

import * as React from "react";
import { IconArchive, IconReload, IconTrash } from "@tabler/icons-react";
import { type Row } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
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
import {
  archiveCreneauAction,
  deleteCreneauPermanentlyAction,
  unarchiveCreneauAction,
} from "../creneau.action";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface DeleteCreneausDialogProps
  extends React.ComponentPropsWithoutRef<typeof Dialog> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  Creneaus: Row<ICreneau>["original"][];
  permanent?: boolean;
  /** Désarchiver (réactiver) au lieu d’archiver. */
  restore?: boolean;
}

function creneauClassesCount(creneau: ICreneau) {
  return creneau.classesCount ?? 0;
}

export function DeleteCreneausDialog({
  showTrigger = true,
  onSuccess,
  Creneaus,
  permanent = false,
  restore = false,
  ...props
}: DeleteCreneausDialogProps) {
  const t = useTranslations("teaching.vacation.deleteDialog");
  const tc = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const { refresh } = useRefresh();

  const count = Creneaus.length;
  const blockedCount = Creneaus.reduce(
    (total, creneau) => total + creneauClassesCount(creneau),
    0,
  );
  const blocked = permanent && blockedCount > 0;
  const mode = permanent ? "delete" : restore ? "restore" : "archive";

  const handleConfirm = () => {
    if (blocked) return;
    startTransition(async () => {
      let hasError = false;
      for (const creneau of Creneaus) {
        const [, err] =
          mode === "delete"
            ? await deleteCreneauPermanentlyAction({ id: creneau.id })
            : mode === "restore"
              ? await unarchiveCreneauAction({
                  id: creneau.id,
                  nameCreneau: creneau.nameCreneau,
                })
              : await archiveCreneauAction(creneau);
        if (err) {
          toast.error(
            err.message ??
              (mode === "delete"
                ? tc("errorDelete")
                : mode === "restore"
                  ? t("restoreFailed")
                  : tc("errorArchive")),
          );
          hasError = true;
        }
      }
      if (!hasError) {
        toast.success(
          mode === "delete"
            ? count === 1
              ? t("deletedOne")
              : t("deletedMany")
            : mode === "restore"
              ? count === 1
                ? t("restoredOne")
                : t("restoredMany")
              : count === 1
                ? t("archivedOne")
                : t("archivedMany"),
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
            {mode === "delete" ? (
              <IconTrash className="mr-2 size-4" aria-hidden="true" />
            ) : mode === "restore" ? (
              <IconReload className="mr-2 size-4" aria-hidden="true" />
            ) : (
              <IconArchive className="mr-2 size-4" aria-hidden="true" />
            )}
            {mode === "delete"
              ? t("deleteCount", { count })
              : mode === "restore"
                ? t("restoreCount", { count })
                : t("archiveCount", { count })}
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
              ? tc("cannotDelete")
              : mode === "delete"
                ? count === 1
                  ? t("titleDeleteOne")
                  : t("titleDeleteMany", { count })
                : mode === "restore"
                  ? count === 1
                    ? t("titleRestoreOne")
                    : t("titleRestoreMany", { count })
                  : count === 1
                    ? t("titleArchiveOne")
                    : t("titleArchiveMany", { count })}
          </DialogTitle>
          <DialogDescription>
            {blocked
              ? count === 1
                ? t("blockedOne", { count: blockedCount })
                : t("blockedMany", { count: blockedCount })
              : mode === "delete"
                ? count === 1
                  ? t("permanentOne")
                  : t("permanentMany")
                : mode === "restore"
                  ? count === 1
                    ? t("restoreOne")
                    : t("restoreMany")
                  : count === 1
                    ? t("archiveOne")
                    : t("archiveMany")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:space-x-0">
          <DialogClose asChild>
            <Button variant="outline">
              {blocked ? tc("close") : tc("cancel")}
            </Button>
          </DialogClose>
          {blocked ? null : (
            <Button
              aria-label={
                mode === "delete"
                  ? tc("deleteSelection")
                  : mode === "restore"
                    ? t("restoreCount", { count })
                    : tc("archiveSelection")
              }
              variant={mode === "restore" ? "default" : "destructive"}
              onClick={handleConfirm}
              disabled={isPending}
            >
              {isPending ? (
                <IconReload
                  className="mr-2 size-4 animate-spin"
                  aria-hidden="true"
                />
              ) : mode === "delete" ? (
                <IconTrash className="mr-2 size-4" aria-hidden="true" />
              ) : mode === "restore" ? (
                <IconReload className="mr-2 size-4" aria-hidden="true" />
              ) : (
                <IconArchive className="mr-2 size-4" aria-hidden="true" />
              )}
              {mode === "delete"
                ? tc("delete")
                : mode === "restore"
                  ? t("restore")
                  : tc("archive")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
