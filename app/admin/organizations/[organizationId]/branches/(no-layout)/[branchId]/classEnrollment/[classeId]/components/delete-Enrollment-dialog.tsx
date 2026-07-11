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
import { IclassEnrollment } from "@/src/interfaces/classEnrollment";
import { useRefresh } from "@/src/hooks/RefreshContext";
import { archiveClassEnrollAction } from "../../classEnrollment.action";

interface DeleteEnrollmentsDialogProps
  extends React.ComponentPropsWithoutRef<typeof Dialog> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  enrollments: Row<IclassEnrollment>["original"][];
}

export function DeleteClassEnrollmentsDialog({
  showTrigger = true,
  onSuccess,
  enrollments,
  ...props
}: DeleteEnrollmentsDialogProps) {
  const [isArchivePending, startArchiveTransition] = React.useTransition();

  const { refresh } = useRefresh();
  const handleArchive = () => {
    startArchiveTransition(async () => {
      let hasError = false;
      for (const enrollment of enrollments) {
        const [, err] = await archiveClassEnrollAction({
          id: enrollment.id,
          schoolYearId: enrollment.schoolYearId ?? "",
          studentId: enrollment.studentId ?? "",
          classeId: enrollment.classeId ?? "",
        });
        if (err) {
          toast.error(err.message ?? "Erreur lors de l'annulation");
          hasError = true;
        }
      }
      if (!hasError) {
        toast.success(
          enrollments.length === 1
            ? "Inscription annulée"
            : "Inscriptions annulées",
        );
        refresh();
        onSuccess?.();
        props.onOpenChange?.(false);
      }
    });
  };

  const count = enrollments.length;

  return (
    <Dialog {...props}>
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <IconArchive className="mr-2 size-4" aria-hidden="true" />
            Annuler ({count})
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {count === 1
              ? "Annuler l'inscription ?"
              : `Annuler ${count} inscriptions ?`}
          </DialogTitle>
          <DialogDescription>
            {count === 1
              ? "L'inscription sera annulée et masquée des listes actives mais l'historique sera conservé."
              : "Ces inscriptions seront annulées et masquées des listes actives mais l'historique sera conservé."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:space-x-0">
          <DialogClose asChild>
            <Button variant="outline">Annuler</Button>
          </DialogClose>
          <Button
            aria-label="Annuler la sélection"
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
            Annuler l'inscription
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
