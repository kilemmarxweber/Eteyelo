"use client";

import { useAppTransition as useTransition } from "@/hooks/use-app-transition";

import * as React from "react";
import { IconArchive, IconReload } from "@tabler/icons-react";
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
import { ITeaching } from "@/src/interfaces/Teaching";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { archiveTeachingAction } from "../../teaching.action";

interface DeleteTeachingsDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  teaches: Row<ITeaching>["original"][];
}

export function DeleteTeachingsDialog({
  showTrigger = true,
  onSuccess,
  teaches,
  ...props
}: DeleteTeachingsDialogProps) {
  const t = useTranslations("teaching.assignments.deactivateDialog");
  const tc = useTranslations("common");
  const [isArchivePending, startArchiveTransition] = useTransition();

  const { refresh } = useRefresh();
  const handleArchive = () => {
    startArchiveTransition(async () => {
      let hasError = false;
      for (const teache of teaches) {
        const [, err] = await archiveTeachingAction({
          id: teache.id,
        });
        if (err) {
          toast.error(err.message ?? t("errorDeactivate"));
          hasError = true;
        }
      }
      if (!hasError) {
        toast.success(
          teaches.length === 1 ? t("deactivatedOne") : t("deactivatedMany"),
        );
        refresh();
        onSuccess?.();
        props.onOpenChange?.(false);
      }
    });
  };

  const count = teaches.length;

  return (
    <Dialog {...props}>
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <IconArchive className="mr-2 size-4" aria-hidden="true" />
            {t("deactivateCount", { count })}
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {count === 1
              ? t("titleOne")
              : t("titleManyCount", { count })}
          </DialogTitle>
          <DialogDescription>
            {count === 1 ? t("descOne") : t("descMany")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:space-x-0">
          <DialogClose asChild>
            <Button variant="outline">{tc("cancel")}</Button>
          </DialogClose>
          <Button
            aria-label={t("deactivateSelection")}
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
            {tc("deactivate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
