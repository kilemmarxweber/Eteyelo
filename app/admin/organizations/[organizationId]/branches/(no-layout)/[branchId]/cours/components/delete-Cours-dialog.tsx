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
import { ICours } from "@/src/interfaces/Cours";
import {
  archiveCoursAction,
  deleteCoursPermanentlyAction,
} from "../../cours/cours.action";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface DeleteCoursDialogProps
  extends React.ComponentPropsWithoutRef<typeof Dialog> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  Cours: Row<ICours>["original"][];
  permanent?: boolean;
}

function coursTeachingsCount(cours: ICours) {
  return cours.teachingsCount ?? 0;
}

export function DeleteCoursDialog({
  showTrigger = true,
  onSuccess,
  Cours,
  permanent = false,
  ...props
}: DeleteCoursDialogProps) {
  const t = useTranslations("teaching.courses.deleteDialog");
  const tc = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const { refresh } = useRefresh();

  const count = Cours.length;
  const blockedCount = Cours.reduce(
    (total, cours) => total + coursTeachingsCount(cours),
    0,
  );
  const blocked = permanent && blockedCount > 0;

  const handleConfirm = () => {
    if (blocked) return;
    startTransition(async () => {
      let hasError = false;
      for (const cours of Cours) {
        const [, err] = permanent
          ? await deleteCoursPermanentlyAction({ id: cours.id })
          : await archiveCoursAction({
              id: cours.id,
              codeCours: cours.codeCours,
              nameCours: cours.nameCours,
            });
        if (err) {
          toast.error(
            err.message ??
              (permanent ? tc("errorDelete") : t("errorDeactivate")),
          );
          hasError = true;
        }
      }
      if (!hasError) {
        toast.success(
          permanent
            ? count === 1
              ? t("deletedOne")
              : t("deletedMany")
            : count === 1
              ? t("deactivatedOne")
              : t("deactivatedMany"),
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
            {permanent
              ? t("deleteCount", { count })
              : t("deactivateCount", { count })}
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
              : permanent
                ? count === 1
                  ? t("titleDeleteOne")
                  : t("titleDeleteMany", { count })
                : count === 1
                  ? t("titleDeactivateOne")
                  : t("titleDeactivateMany", { count })}
          </DialogTitle>
          <DialogDescription>
            {blocked
              ? count === 1
                ? t("blockedOne", { count: blockedCount })
                : t("blockedMany", { count: blockedCount })
              : permanent
                ? count === 1
                  ? t("permanentOne")
                  : t("permanentMany")
                : count === 1
                  ? t("deactivateOne")
                  : t("deactivateMany")}
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
                permanent ? tc("deleteSelection") : t("deactivateSelection")
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
              {permanent ? tc("delete") : tc("deactivate")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
