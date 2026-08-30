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
import { IPersonnel } from "@/src/interfaces/Personnel";
import {
  archivePersonalAction,
  deletePersonnelPermanentlyAction,
} from "../personnel.action";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface DeletePersonalDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  personals: Row<IPersonnel>["original"][];
  /** Si true : retire de la branche (garde le membre org). */
  permanent?: boolean;
}

export function DeletePersonalDialog({
  showTrigger = true,
  onSuccess,
  personals,
  permanent = false,
  ...props
}: DeletePersonalDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { refresh } = useRefresh();
  const t = useTranslations("users.staff.delete");
  const tCommon = useTranslations("common");

  const handleConfirm = () => {
    startTransition(async () => {
      try {
        if (permanent) {
          const [result, error] = await deletePersonnelPermanentlyAction({
            ids: personals.map((p) => p.id),
          });
          if (error) {
            toast.error(error.message ?? tCommon("errorDelete"));
            return;
          }
          if (!result?.ok) {
            toast.error(result?.message ?? tCommon("errorDelete"));
            return;
          }
          toast.success(
            personals.length === 1
              ? t("deactivatedOne")
              : t("deactivatedMany"),
          );
        } else {
          await archivePersonalAction({
            ids: personals.map((p) => p.id),
          });
          toast.success(
            personals.length === 1 ? t("archivedOne") : t("archivedMany"),
          );
        }

        onSuccess?.();
        refresh();
        props.onOpenChange?.(false);
      } catch {
        toast.error(
          permanent ? tCommon("errorDelete") : tCommon("errorArchive"),
        );
      }
    });
  };

  const count = personals.length;

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
              ? `${tCommon("delete")} (${count})`
              : `${tCommon("archive")} (${count})`}
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {permanent
              ? count === 1
                ? t("deactivateOne")
                : t("deactivateMany", { count })
              : count === 1
                ? t("archiveOne")
                : t("archiveMany", { count })}
          </DialogTitle>
          <DialogDescription>
            {permanent
              ? count === 1
                ? t("permanentDescOne")
                : t("permanentDescMany")
              : count === 1
                ? t("archiveDescOne")
                : t("archiveDescMany")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:space-x-0">
          <DialogClose asChild>
            <Button variant="outline">{tCommon("cancel")}</Button>
          </DialogClose>
          <Button
            aria-label={
              permanent ? t("deactivateInBranch") : tCommon("archiveSelection")
            }
            variant={permanent ? "destructive" : "outline"}
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending && (
              <IconReload
                className="mr-2 size-4 animate-spin"
                aria-hidden="true"
              />
            )}
            {permanent ? t("deactivateInBranch") : tCommon("archive")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
