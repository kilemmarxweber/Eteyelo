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
import { ISchoolYear } from "@/src/interfaces/SchoolYear";
import { archiveSchoolYearAction } from "../schoolYear.action";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface DeleteSchoolYearsDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  SchoolYears: Row<ISchoolYear>["original"][];
}

export function DeleteSchoolYearsDialog({
  showTrigger = true,
  onSuccess,
  SchoolYears,
  ...props
}: DeleteSchoolYearsDialogProps) {
  const [isArchivePending, startArchiveTransition] = React.useTransition();

  const { refresh } = useRefresh();
  const handleArchive = () => {
    startArchiveTransition(async () => {
      let hasError = false;
      for (const schoolYear of SchoolYears) {
        const [, err] = await archiveSchoolYearAction({
          id: schoolYear.id,
        });
        if (err) {
          toast.error(err.message ?? "Erreur lors de la clôture");
          hasError = true;
        }
      }
      if (!hasError) {
        toast.success(
          SchoolYears.length === 1
            ? "Année scolaire clôturée"
            : "Années scolaires clôturées",
        );
        refresh();
        onSuccess?.();
        props.onOpenChange?.(false);
      }
    });
  };

  const count = SchoolYears.length;

  return (
    <Dialog {...props}>
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <IconArchive className="mr-2 size-4" aria-hidden="true" />
            Clôturer ({count})
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {count === 1
              ? "Clôturer l'année scolaire ?"
              : `Clôturer ${count} années scolaires ?`}
          </DialogTitle>
          <DialogDescription>
            {count === 1
              ? "L'année scolaire sera clôturée et masquée des listes actives mais l'historique sera conservé."
              : "Ces années scolaires seront clôturées et masquées des listes actives mais l'historique sera conservé."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:space-x-0">
          <DialogClose asChild>
            <Button variant="outline">Annuler</Button>
          </DialogClose>
          <Button
            aria-label="Clôturer la sélection"
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
            Clôturer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
