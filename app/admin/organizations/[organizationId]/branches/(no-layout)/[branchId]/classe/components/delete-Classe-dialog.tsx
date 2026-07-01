"use client";

import * as React from "react";
import {IconReload, IconTrash} from "@tabler/icons-react"
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
import { IClasse } from "@/src/interfaces/Classe";
import { deleteClasseAction } from "../classe.action";
import { useRefresh } from "@/src/hooks/RefreshContext";

interface DeleteClassesDialogProps
  extends React.ComponentPropsWithoutRef<typeof Dialog> {
  showTrigger?: boolean;
  onSuccess?: () => void;
  Classes: Row<IClasse>["original"][];
}

export function DeleteClassesDialog({
  showTrigger = true,
  onSuccess,
  Classes,
  ...props
}: DeleteClassesDialogProps) {
  const [isDeletePending, startDeleteTransition] = React.useTransition();

  const { refresh} = useRefresh()
  const handleDelete = async () => {
    startDeleteTransition(async () => {
      for (const classe of Classes) {
        try {
          await deleteClasseAction({
            id: classe.id,
            codeClasse: classe.codeClasse,
            nameClasse: classe.nameClasse,
          })
        } catch (err) {
          toast.error(`Failed to delete classe ${classe.id}: ${err}`);
        }
      }
  
      onSuccess?.()
      setTimeout(() => {
        console.log("Component refreshed")
        refresh()
      }, 1000)
    });
  };

  return (
    <Dialog {...props}>
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <IconTrash className="mr-2 size-4" aria-hidden="true" />
            Delete ({Classes.length})
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Êtes-vous absolument sûr?</DialogTitle>
          <DialogDescription>
            Cette action ne peut pas être annulée.Cela supprimera en permanence
            votre <span className="font-medium">{Classes.length}</span>
            {Classes.length === 1 ? " Classe" : " Classes"} from our servers.
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
              toast.success("Classes deleted");
              onSuccess?.();
              handleDelete()
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
