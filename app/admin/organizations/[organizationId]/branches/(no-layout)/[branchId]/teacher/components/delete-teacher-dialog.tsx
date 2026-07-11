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
import { ITeacher } from "@/src/interfaces/Teacher";
import { archiveTeacherAction } from "../teacher.action";

interface DeleteTeacherDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  teachers: Row<ITeacher>["original"][];
}

export function DeleteTeacherDialog({
  showTrigger = true,
  onSuccess,
  teachers,
  ...props
}: DeleteTeacherDialogProps) {
  const [isArchivePending, startArchiveTransition] = React.useTransition();

  const handleArchive = () => {
    startArchiveTransition(async () => {
      try {
        let hasArchived = false;

        for (const teacher of teachers) {
          const [result, error] = await archiveTeacherAction({
            id: teacher.id,
          });

          if (error) {
            toast.error(error.message ?? "Erreur lors de l'archivage");
            continue;
          }

          if (result?.success) {
            hasArchived = true;
            toast.success(result.message ?? "Enseignant archivé");
          } else {
            toast.error(result?.message ?? "Erreur lors de l'archivage");
          }
        }

        if (hasArchived) {
          onSuccess?.();
          props.onOpenChange?.(false);
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Erreur serveur";
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
            <IconArchive className="mr-2 size-4" aria-hidden="true" />
            Archiver ({count})
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {count === 1
              ? "Archiver l'enseignant ?"
              : `Archiver ${count} enseignants ?`}
          </DialogTitle>
          <DialogDescription>
            {count === 1
              ? "L'enseignant sera masqué des listes actives mais l'historique sera conservé."
              : "Ces enseignants seront masqués des listes actives mais l'historique sera conservé."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:space-x-0">
          <DialogClose asChild>
            <Button variant="outline">Annuler</Button>
          </DialogClose>
          <Button
            aria-label="Archiver la sélection"
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
            Archiver
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
