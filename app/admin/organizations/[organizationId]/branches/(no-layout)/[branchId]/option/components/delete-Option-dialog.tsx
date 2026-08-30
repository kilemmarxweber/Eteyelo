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
import { IOption } from "@/src/interfaces/Option";
import {
  archiveOptionAction,
  deleteOptionPermanentlyAction,
} from "../option.action";
import { useRefresh } from "@/src/hooks/RefreshContext";
import type { TrainingLabelKey } from "@/lib/training-labels";

interface DeleteOptionsDialogProps
  extends React.ComponentPropsWithoutRef<typeof Dialog> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  Options: Row<IOption>["original"][];
  permanent?: boolean;
  labelKey?: TrainingLabelKey;
}

function optionClassesCount(option: IOption) {
  return option.classesCount ?? option.classes?.length ?? 0;
}

export function DeleteOptionsDialog({
  showTrigger = true,
  onSuccess,
  Options,
  permanent = false,
  labelKey = "school",
  ...props
}: DeleteOptionsDialogProps) {
  const tClasses = useTranslations("classes");
  const tCommon = useTranslations("common");
  const tOption = (key: string, values?: Record<string, string | number>) =>
    tClasses(`option.${labelKey}.${key}`, values);
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
              (permanent ? tCommon("errorDelete") : tCommon("errorArchive")),
          );
          hasError = true;
        }
      }
      if (!hasError) {
        toast.success(
          permanent
            ? count === 1
              ? tOption("deleted")
              : tOption("deletedPlural")
            : count === 1
              ? tOption("archived")
              : tOption("archivedPlural"),
        );
        refresh();
        onSuccess?.();
        props.onOpenChange?.(false);
      }
    });
  };

  const dialogTitle = blocked
    ? tCommon("cannotDelete")
    : permanent
      ? count === 1
        ? tOption("deleteOne")
        : tOption("deleteMany", { count })
      : count === 1
        ? tOption("archiveOne")
        : tOption("archiveMany", { count });

  const dialogDescription = blocked
    ? count === 1
      ? tOption("blockedOne", { classCount: blockedCount })
      : tOption("blockedMany", { classCount: blockedCount })
    : permanent
      ? count === 1
        ? tOption("irreversibleOne")
        : tOption("irreversibleMany")
      : count === 1
        ? tOption("hiddenOne")
        : tOption("hiddenMany");

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
      <DialogContent
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:space-x-0">
          <DialogClose asChild>
            <Button variant="outline">
              {blocked ? tCommon("close") : tCommon("cancel")}
            </Button>
          </DialogClose>
          {blocked ? null : (
            <Button
              aria-label={
                permanent
                  ? tCommon("deleteSelection")
                  : tCommon("archiveSelection")
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
              {permanent ? tCommon("delete") : tCommon("archive")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
