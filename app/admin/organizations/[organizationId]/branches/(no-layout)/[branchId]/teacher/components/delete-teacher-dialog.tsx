"use client";

import * as React from "react";
import { IconReload, IconTrash } from "@tabler/icons-react";
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
import { deleteTeacherAction } from "../teacher.action";

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
  const [isDeletePending, startDeleteTransition] = React.useTransition();

  const handleDelete = async () => {
    startDeleteTransition(async () => {
      try {
        let hasDeleted = false;

        for (const teacher of teachers) {
          const [result, error] = await deleteTeacherAction({
            id: teacher.id,
          });

          if (error) {
            toast.error(error.message);
            continue;
          }

          if (result?.success) {
            hasDeleted = true;
            toast.success(result.message);
          } else {
            toast.error(result?.message);
          }
        }

        if (hasDeleted) {
          onSuccess?.();
        }
      } catch (err: any) {
        toast.error(err?.message || "Erreur serveur");
      }
    });
  };

  return (
    <Dialog {...props}>
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <IconTrash className="mr-2 size-4" aria-hidden="true" />
            Delete ({teachers.length})
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Êtes-vous absolument sûr?</DialogTitle>
          <DialogDescription>
            Cette action ne peut pas être annulée.Cela supprimera en permanence
            votre <span className="font-medium">{teachers.length}</span>
            {teachers.length === 1 ? " teacher" : " teachers"} from our servers.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:space-x-0">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            aria-label="Delete selected rows"
            variant="destructive"
            onClick={() => {
              props.onOpenChange?.(false);
              handleDelete();
            }}
            disabled={isDeletePending}
          >
            {isDeletePending && (
              <IconReload
                className="mr-2 size-4 animate-spin"
                aria-hidden="true"
              />
            )}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
