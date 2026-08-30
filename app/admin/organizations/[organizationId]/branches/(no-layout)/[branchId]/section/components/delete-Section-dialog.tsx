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
import { ISection } from "@/src/interfaces/Section";
import {
  archiveSectionAction,
  deleteSectionPermanentlyAction,
} from "../section.action";
import { useRefresh } from "@/src/hooks/RefreshContext";
import type { TrainingLabelKey } from "@/lib/training-labels";

interface DeleteSectionsDialogProps
  extends React.ComponentPropsWithoutRef<typeof Dialog> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  Sections: Row<ISection>["original"][];
  permanent?: boolean;
  labelKey?: TrainingLabelKey;
}

function sectionClassesCount(section: ISection) {
  return section.classesCount ?? 0;
}

function sectionOptionsCount(section: ISection) {
  return section.optionsCount ?? section.option?.length ?? 0;
}

export function DeleteSectionsDialog({
  showTrigger = true,
  onSuccess,
  Sections,
  permanent = false,
  labelKey = "school",
  ...props
}: DeleteSectionsDialogProps) {
  const tClasses = useTranslations("classes");
  const tCommon = useTranslations("common");
  const tSection = (key: string, values?: Record<string, string | number>) =>
    tClasses(`section.${labelKey}.${key}`, values);
  const [isPending, startTransition] = useTransition();
  const { refresh } = useRefresh();

  const count = Sections.length;
  const blockedCount = Sections.reduce(
    (total, section) => total + sectionClassesCount(section),
    0,
  );
  const linkedOptionsCount = Sections.reduce(
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
              (permanent ? tCommon("errorDelete") : tCommon("errorArchive")),
          );
          hasError = true;
        }
      }
      if (!hasError) {
        toast.success(
          permanent
            ? count === 1
              ? tSection("deleted")
              : tSection("deletedPlural")
            : count === 1
              ? tSection("archived")
              : tSection("archivedPlural"),
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
        ? tSection("deleteOne")
        : tSection("deleteMany", { count })
      : count === 1
        ? tSection("archiveOne")
        : tSection("archiveMany", { count });

  const dialogDescription = blocked
    ? count === 1
      ? tSection("blockedOne", { classCount: blockedCount })
      : tSection("blockedMany", { classCount: blockedCount })
    : permanent
      ? count === 1
        ? linkedOptionsCount > 0
          ? tSection("irreversibleWithOptions", {
              optionCount: linkedOptionsCount,
            })
          : tSection("irreversibleOne")
        : tSection("irreversibleMany")
      : count === 1
        ? tSection("hiddenOne")
        : tSection("hiddenMany");

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
