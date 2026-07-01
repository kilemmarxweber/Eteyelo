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
import { IParent } from "@/src/interfaces/Parent";
import { deleteParentAction } from "../parent.action";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface DeleteParentDialogProps extends React.ComponentPropsWithoutRef<
  typeof Dialog
> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  parents: Row<IParent>["original"][];
}

export function DeleteParentDialog({
  showTrigger = true,
  onSuccess,
  parents,
  ...props
}: DeleteParentDialogProps) {
  const [isDeletePending, startDeleteTransition] = React.useTransition();

  const { refresh } = useRefresh();
  const handleDelete = async () => {
    startDeleteTransition(async () => {
      try {
        for (const parent of parents) {
          const [result, error] = await deleteParentAction({
            id: parent.id,
          });

          if (error) {
            toast.error(error.message);
            continue;
          }

          if (result?.success) {
            toast.success(result.message);
          } else {
            toast.error(result?.message);
          }
        }
        refresh();
        onSuccess?.();
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
            Delete ({parents.length})
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Êtes-vous absolument sûr?</DialogTitle>
          <DialogDescription>
            Cette action ne peut pas être annulée.Cela supprimera en permanence
            votre <span className="font-medium">{parents.length}</span>
            {parents.length === 1 ? " parent" : " parents"} from our servers.
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
