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
import { ITeacher } from "@/src/interfaces/Teacher";
import {
  archiveTeacherAction,
  deleteTeacherPermanentlyAction,
} from "../teacher.action";

interface DeleteTeacherDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  teachers: Row<ITeacher>["original"][];
  /** Si true : retire de la branche (garde le membre org). */
  permanent?: boolean;
}

export function DeleteTeacherDialog({
  showTrigger = true,
  onSuccess,
  teachers,
  permanent = false,
  ...props
}: DeleteTeacherDialogProps) {
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("users.teachers.delete");
  const tCommon = useTranslations("common");

  const handleConfirm = () => {
    startTransition(async () => {
      try {
        let hasDone = false;

        for (const teacher of teachers) {
          const [result, error] = permanent
            ? await deleteTeacherPermanentlyAction({ id: teacher.id })
            : await archiveTeacherAction({ id: teacher.id });

          if (error) {
            toast.error(
              error.message ??
                (permanent ? tCommon("errorDelete") : tCommon("errorArchive")),
            );
            continue;
          }

          if (result && ("ok" in result ? result.ok : result.success)) {
            hasDone = true;
            toast.success(
              result.message ??
                (permanent
                  ? t("deactivatedOne")
                  : t("archivedOne")),
            );
          } else {
            toast.error(
              result?.message ??
                (permanent ? tCommon("errorDelete") : tCommon("errorArchive")),
            );
          }
        }

        if (hasDone) {
          onSuccess?.();
          props.onOpenChange?.(false);
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : tCommon("errorGeneric");
        toast.error(message);
      }
    });
  };

  const count = teachers.length;

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
            {permanent ? tCommon("deactivate") : tCommon("archive")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
