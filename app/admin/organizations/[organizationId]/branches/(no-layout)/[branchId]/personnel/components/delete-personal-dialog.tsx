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
import { IPersonnel } from "@/src/interfaces/Personnel";
import { deletePersonalAction } from "../personnel.action";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface DeletePersonalDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  personals: Row<IPersonnel>["original"][];
}

export function DeletePersonalDialog({
  showTrigger = true,
  onSuccess,
  personals,
  ...props
}: DeletePersonalDialogProps) {
  const [isDeletePending, startDeleteTransition] = React.useTransition();

  const { refresh } = useRefresh();
  const handleDelete = async () => {
    startDeleteTransition(async () => {
      try {
        await deletePersonalAction({
          ids: personals.map((p) => p.id),
        });

        toast.success("personals deleted");
        onSuccess?.();
        refresh();
      } catch (err) {
        toast.error("Failed to delete personnels");
      }
    });
  };

  return (
    <Dialog {...props}>
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <IconTrash className="mr-2 size-4" aria-hidden="true" />
            Delete ({personals.length})
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Êtes-vous absolument sûr?</DialogTitle>
          <DialogDescription>
            Cette action ne peut pas être annulée. Cela supprimera en permanence
            votre <span className="font-medium">{personals.length}</span>
            {personals.length === 1 ? " personal" : " personals"} from our
            servers.
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
              toast.success("personals deleted");
              onSuccess?.();
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
